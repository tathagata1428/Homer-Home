/**
 * POST /api/db — browser data access (replaces direct Supabase REST + Realtime).
 *
 * Auth: Authorization: Bearer <access_token from /api/auth>.
 *
 * Body is either a query spec produced by assets/homer-db.js:
 *   { table, op, columns, filters, orders, limit, offset, single, values,
 *     onConflict, ignoreDuplicates, returning }
 * or a change poll:
 *   { op: 'changes', since: { field_state: '<iso>', messages: '<iso>', ... } }
 *   → { now, changes: { field_state: [rows], ... } }
 *
 * Every query is pinned to the caller's user_id, and only the tables
 * below are reachable.
 *
 * Secondbrain bridge (lib/hub-bridge.js): a change poll also pulls hub changes
 * (throttled), and writes to bridged field_state rows are pushed to the hub,
 * both in the background after the response.
 */
import { executeSpec, query, verifySessionToken, isDbConfigured } from '../../lib/db.js';
import { pullHub, pushField, isBridgedField } from '../../lib/hub-bridge.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const TABLES = new Set([
  'field_state', 'focus_sessions', 'joey_meta', 'journal', 'memories',
  'messages', 'profiles', 'tasks', 'habits', 'habit_completions'
]);

// Column that advances on every write, used by the change poll.
const CHANGE_COLUMN = {
  field_state: 'updated_at',
  memories: 'updated_at',
  tasks: 'updated_at',
  profiles: 'updated_at',
  joey_meta: 'updated_at',
  habits: 'updated_at',
  messages: 'created_at'
};

const CHANGE_LIMIT = 500;
// Re-read a small window before the cursor so rows from transactions that
// committed out of order are not skipped; clients dedupe.
const CHANGE_OVERLAP_MS = 2000;

function json(body, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

async function pollChanges(userId, since) {
  const [{ now }] = await query('SELECT clock_timestamp() AS now');
  const changes = {};
  for (const table of Object.keys(since || {})) {
    const col = CHANGE_COLUMN[table];
    const cursor = since[table];
    if (!col || !cursor) continue;
    const from = new Date(new Date(cursor).getTime() - CHANGE_OVERLAP_MS);
    if (isNaN(from)) continue;
    changes[table] = await query(
      `SELECT * FROM "${table}" WHERE user_id = $1 AND "${col}" > $2 ORDER BY "${col}" ASC LIMIT ${CHANGE_LIMIT}`,
      [userId, from.toISOString()]
    );
  }
  return { now, changes };
}

function scopeToUser(spec, userId) {
  const scoped = { ...spec, filters: (Array.isArray(spec.filters) ? spec.filters : []).filter((f) => f && f.col !== 'user_id') };
  if (spec.op === 'insert' || spec.op === 'upsert') {
    const rows = Array.isArray(spec.values) ? spec.values : [spec.values];
    scoped.values = rows.filter((r) => r && typeof r === 'object').map((r) => ({ ...r, user_id: userId }));
  } else {
    scoped.filters.push({ col: 'user_id', op: 'eq', value: userId });
  }
  if (spec.op === 'update' && spec.values && typeof spec.values === 'object') {
    const { user_id: _drop, ...rest } = spec.values;
    scoped.values = rest;
  }
  return scoped;
}

/** field_state rows a write touched that the hub bridge mirrors. */
function bridgedWrites(spec) {
  if (spec.table !== 'field_state' || (spec.op !== 'upsert' && spec.op !== 'insert' && spec.op !== 'update')) return [];
  const rows = Array.isArray(spec.values) ? spec.values : [spec.values];
  return rows.filter((r) => r && isBridgedField(r.field_id) && typeof r.value === 'string')
    .map((r) => ({ fieldId: r.field_id, value: r.value }));
}

export async function onRequest(context) {
  const { request } = context;
  const later = (promise) => (typeof context.waitUntil === 'function' ? context.waitUntil(promise) : promise);
  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!isDbConfigured()) return json({ error: 'Database not configured' }, 503);

  const authHeader = String(request.headers.get('authorization') || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const user = await verifySessionToken(token);
  if (!user) return json({ error: 'Invalid or expired token' }, 401);

  let body;
  try { body = await request.json(); } catch (_err) { return json({ error: 'Invalid JSON' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'Invalid body' }, 400);

  try {
    if (body.op === 'changes') {
      later(pullHub(user.id));
      return json(await pollChanges(user.id, body.since));
    }

    if (!TABLES.has(body.table)) return json({ error: 'Unknown table' }, 400);
    if (!['select', 'insert', 'upsert', 'update', 'delete'].includes(body.op)) return json({ error: 'Unknown op' }, 400);
    if (body.op === 'upsert' && String(body.onConflict || '').split(',').map((c) => c.trim()).includes('user_id') === false) {
      // Unique keys in this schema all start with user_id; without it the
      // conflict target could match another user's row.
      return json({ error: 'upsert onConflict must include user_id' }, 400);
    }
    const result = await executeSpec(scopeToUser(body, user.id));
    if (!result.error) for (const w of bridgedWrites(body)) later(pushField(user.id, w.fieldId, w.value));
    return json(result);
  } catch (err) {
    return json({ data: null, error: { message: err.message || 'Database error' } }, 500);
  }
}

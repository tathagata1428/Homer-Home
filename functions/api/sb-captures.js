/**
 * POST /api/sb-captures — the secondbrain hub's Captures, for the Captures
 * panel (assets/homer-sb-captures.v20261022a.js).
 *
 * Auth: Authorization: Bearer <access_token from /api/auth>, and only the
 * owner: the hub is reached as Homer's own device (HUB_TOKEN, the same one
 * lib/hub-bridge.js uses), so these are the owner's captures.
 *
 * Body: { action: 'pull', sinceSeq } → the hub's { rows, nextSeq }
 *       { action: 'push', rows }     → the hub's v2 { accepted, rejected }
 *
 * Captures are not a field_state blob like the bridged fields: their pictures
 * are too big for one, so the browser keeps them (IndexedDB) and this only
 * relays. Nothing here runs on its own; the browser calls it on Sync.
 */
import { verifySessionToken, resolveOwnerId } from '../../lib/db.js';

const TABLE = 'captures';

function env(name) {
  return String(process.env[name] || '').trim();
}

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function relay(res) {
  const text = await res.text();
  return new Response(text || '{}', {
    status: res.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export async function onRequestPost(context) {
  const { request } = context;
  if (!env('HUB_TOKEN')) return json({ error: 'Second Brain is not connected (HUB_TOKEN is not set).' }, 503);

  const authHeader = String(request.headers.get('authorization') || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const user = await verifySessionToken(token);
  if (!user) return json({ error: 'Invalid or expired token' }, 401);
  const ownerId = await resolveOwnerId();
  if (!ownerId || String(user.id) !== ownerId) return json({ error: 'Captures are only shared with the owner account.' }, 403);

  let body;
  try { body = await request.json(); } catch (_err) { return json({ error: 'Invalid JSON' }, 400); }

  const hub = (env('HUB_URL') || 'https://hub.b4it.ro').replace(/\/+$/, '');
  const headers = { authorization: 'Bearer ' + env('HUB_TOKEN'), 'content-type': 'application/json' };
  try {
    if (body && body.action === 'pull') {
      const since = /^\d+$/.test(String(body.sinceSeq ?? '0')) ? String(body.sinceSeq ?? '0') : '0';
      return relay(await fetch(`${hub}/api/sync/pull?table=${TABLE}&sinceSeq=${since}`, {
        headers, signal: AbortSignal.timeout(60000)
      }));
    }
    if (body && body.action === 'push') {
      if (!Array.isArray(body.rows)) return json({ error: 'rows must be an array' }, 400);
      return relay(await fetch(`${hub}/api/sync/push`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ table: TABLE, rows: body.rows, ackVersion: 2 }),
        signal: AbortSignal.timeout(60000)
      }));
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ error: 'Second Brain could not be reached: ' + ((err && err.message) || 'network error') }, 502);
  }
}

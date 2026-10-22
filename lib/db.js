/**
 * Homer database layer — self-hosted PostgreSQL (replaces Supabase).
 *
 * Exports:
 *   createDbClient()          — query builder with the subset of the supabase-js
 *                               API Homer uses: from().select/insert/upsert/update/
 *                               delete + eq/neq/gt/gte/lt/lte/like/ilike/in/is/not/
 *                               match/order/limit/range/single/maybeSingle.
 *                               Resolves to { data, error, count } like supabase-js.
 *   query(sql, params)        — raw parameterised query → rows
 *   isDbConfigured()
 *   issueSession(user)        — signed access + refresh tokens (HS256)
 *   verifySessionToken(token) — { id, email } or null
 *   resolveOwnerId()          — UUID of the Homer owner account
 *
 * Connection string: env.HYPERDRIVE.connectionString (set by functions/_middleware.js
 * into DATABASE_URL) or DATABASE_URL directly. Token secret: AUTH_SECRET.
 *
 * Workers cannot reuse a socket across requests, so each query opens its own
 * connection; Hyperdrive pools them on Cloudflare's side.
 */
import pg from 'pg';

const RESERVED_SYNC_EMAIL = 'bogdan.radu@b4it.ro';
const ACCESS_TTL_SECONDS  = 30 * 24 * 3600;
const REFRESH_TTL_SECONDS = 180 * 24 * 3600;
const IDENT = /^[a-z_][a-z0-9_]*$/i;
let cachedOwnerId = '';

// Return values in the same shape PostgREST did: int8 as numbers,
// timestamps as ISO strings, dates as 'YYYY-MM-DD'.
const parseTimestamp = pg.types.getTypeParser(1184);
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));
pg.types.setTypeParser(1082, (v) => v);
for (const oid of [1114, 1184]) {
  pg.types.setTypeParser(oid, (v) => {
    const d = parseTimestamp(v);
    return d instanceof Date && !isNaN(d) ? d.toISOString() : v;
  });
}

function env(name) {
  return String(process.env[name] || '').trim();
}

function databaseUrl() {
  return env('DATABASE_URL');
}

export function isDbConfigured() {
  return !!databaseUrl();
}

export async function query(sql, params = []) {
  const url = databaseUrl();
  if (!url) throw new Error('Missing env var: DATABASE_URL (or HYPERDRIVE binding)');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    client.end().catch(() => {});
  }
}

// ── Query builder ─────────────────────────────────────────────

function ident(name) {
  const n = String(name || '').trim();
  if (!IDENT.test(n)) throw new Error('Invalid identifier: ' + name);
  return '"' + n + '"';
}

function columnList(cols) {
  const raw = String(cols == null ? '*' : cols).trim();
  if (!raw || raw === '*') return '*';
  return raw.split(',').map((c) => ident(c)).join(', ');
}

// Objects/arrays are sent as JSON text so jsonb columns accept them
// (pg would otherwise turn arrays into Postgres array literals).
function toParam(v) {
  if (v !== null && typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v);
  return v;
}

// PostgREST list syntax: '("a","b")' or '(1,2)'
function parseList(raw) {
  const inner = String(raw || '').trim().replace(/^\(/, '').replace(/\)$/, '');
  if (!inner) return [];
  return inner.split(',').map((s) => s.trim().replace(/^"(.*)"$/, '$1'));
}

const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE', ilike: 'ILIKE' };

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.op = 'select';
    this.columns = '*';
    this.returning = null;
    this.filters = [];
    this.orders = [];
    this.limitN = null;
    this.offsetN = null;
    this.singleMode = null;
    this.values = null;
    this.onConflict = null;
    this.ignoreDuplicates = false;
    this.countMode = null;
    this.headOnly = false;
  }

  select(cols, opts) {
    if (this.op === 'select') this.columns = cols == null ? '*' : cols;
    else this.returning = cols == null ? '*' : cols;
    if (opts && opts.count) this.countMode = opts.count;
    if (opts && opts.head) this.headOnly = true;
    return this;
  }
  insert(values) { this.op = 'insert'; this.values = values; return this; }
  upsert(values, opts) {
    this.op = 'upsert';
    this.values = values;
    this.onConflict = (opts && opts.onConflict) || 'id';
    this.ignoreDuplicates = !!(opts && opts.ignoreDuplicates);
    return this;
  }
  update(values) { this.op = 'update'; this.values = values; return this; }
  delete() { this.op = 'delete'; return this; }

  _filter(col, op, value) { this.filters.push({ col, op, value }); return this; }
  eq(c, v) { return this._filter(c, 'eq', v); }
  neq(c, v) { return this._filter(c, 'neq', v); }
  gt(c, v) { return this._filter(c, 'gt', v); }
  gte(c, v) { return this._filter(c, 'gte', v); }
  lt(c, v) { return this._filter(c, 'lt', v); }
  lte(c, v) { return this._filter(c, 'lte', v); }
  like(c, v) { return this._filter(c, 'like', v); }
  ilike(c, v) { return this._filter(c, 'ilike', v); }
  in(c, v) { return this._filter(c, 'in', v); }
  is(c, v) { return this._filter(c, 'is', v); }
  not(c, op, v) { return this._filter(c, 'not.' + op, v); }
  match(obj) { Object.keys(obj || {}).forEach((k) => this.eq(k, obj[k])); return this; }
  order(col, opts) {
    this.orders.push({ col, asc: !(opts && opts.ascending === false), nullsFirst: opts && opts.nullsFirst });
    return this;
  }
  limit(n) { this.limitN = Math.max(0, parseInt(n, 10) || 0); return this; }
  range(from, to) { this.offsetN = from; this.limitN = to - from + 1; return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybe'; return this; }

  /** Plain-object form, used by the browser /api/db proxy. */
  toJSON() {
    return {
      table: this.table, op: this.op, columns: this.columns, returning: this.returning,
      filters: this.filters, orders: this.orders, limit: this.limitN, offset: this.offsetN,
      single: this.singleMode, values: this.values, onConflict: this.onConflict,
      ignoreDuplicates: this.ignoreDuplicates, count: this.countMode, head: this.headOnly
    };
  }

  then(resolve, reject) {
    return executeSpec(this.toJSON()).then(resolve, reject);
  }
}

function buildWhere(filters, params) {
  const parts = [];
  for (const f of filters || []) {
    const col = ident(f.col);
    const negate = String(f.op).startsWith('not.');
    const op = negate ? f.op.slice(4) : f.op;
    let clause;
    if (op === 'is') {
      const v = f.value;
      const kw = v === null || v === 'null' ? 'NULL' : v === true || v === 'true' ? 'TRUE' : v === false || v === 'false' ? 'FALSE' : null;
      if (!kw) throw new Error('Unsupported is() value');
      clause = col + ' IS ' + (negate ? 'NOT ' : '') + kw;
      parts.push(clause);
      continue;
    }
    if (op === 'in') {
      const list = Array.isArray(f.value) ? f.value : parseList(f.value);
      params.push(list.map((x) => (x === null ? null : String(x))));
      clause = col + '::text = ANY($' + params.length + '::text[])';
    } else if (OPS[op]) {
      params.push(toParam(f.value));
      clause = col + ' ' + OPS[op] + ' $' + params.length;
    } else {
      throw new Error('Unsupported filter: ' + f.op);
    }
    parts.push(negate ? 'NOT (' + clause + ')' : clause);
  }
  return parts.length ? ' WHERE ' + parts.join(' AND ') : '';
}

function buildOrder(orders) {
  if (!orders || !orders.length) return '';
  return ' ORDER BY ' + orders.map((o) =>
    ident(o.col) + (o.asc ? ' ASC' : ' DESC') +
    (o.nullsFirst === true ? ' NULLS FIRST' : o.nullsFirst === false ? ' NULLS LAST' : '')
  ).join(', ');
}

function buildSql(spec) {
  const table = ident(spec.table);
  const params = [];
  const ret = spec.returning ? ' RETURNING ' + columnList(spec.returning) : '';

  if (spec.op === 'select') {
    let sql = 'SELECT ' + columnList(spec.columns) + ' FROM ' + table + buildWhere(spec.filters, params) + buildOrder(spec.orders);
    if (spec.limit != null) sql += ' LIMIT ' + Number(spec.limit);
    if (spec.offset != null) sql += ' OFFSET ' + Number(spec.offset);
    return { sql, params };
  }

  if (spec.op === 'insert' || spec.op === 'upsert') {
    const rows = (Array.isArray(spec.values) ? spec.values : [spec.values]).filter((r) => r && typeof r === 'object');
    if (!rows.length) return null;
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const tuples = rows.map((r) => '(' + cols.map((c) => {
      if (!(c in r) || r[c] === undefined) return 'DEFAULT';
      params.push(toParam(r[c]));
      return '$' + params.length;
    }).join(', ') + ')');
    let sql = 'INSERT INTO ' + table + ' (' + cols.map(ident).join(', ') + ') VALUES ' + tuples.join(', ');
    if (spec.op === 'upsert') {
      const conflict = String(spec.onConflict || 'id').split(',').map((c) => c.trim()).filter(Boolean);
      const updates = cols.filter((c) => !conflict.includes(c));
      sql += ' ON CONFLICT (' + conflict.map(ident).join(', ') + ')';
      sql += spec.ignoreDuplicates || !updates.length
        ? ' DO NOTHING'
        : ' DO UPDATE SET ' + updates.map((c) => ident(c) + ' = EXCLUDED.' + ident(c)).join(', ');
    }
    return { sql: sql + ret, params };
  }

  if (spec.op === 'update') {
    const vals = spec.values && typeof spec.values === 'object' ? spec.values : {};
    const cols = Object.keys(vals).filter((c) => vals[c] !== undefined);
    if (!cols.length) return null;
    const sets = cols.map((c) => { params.push(toParam(vals[c])); return ident(c) + ' = $' + params.length; });
    return { sql: 'UPDATE ' + table + ' SET ' + sets.join(', ') + buildWhere(spec.filters, params) + ret, params };
  }

  if (spec.op === 'delete') {
    return { sql: 'DELETE FROM ' + table + buildWhere(spec.filters, params) + ret, params };
  }

  throw new Error('Unsupported op: ' + spec.op);
}

/** Run a builder spec. Never throws — errors come back as { error }. */
export async function executeSpec(spec) {
  try {
    const built = buildSql(spec);
    let rows = built ? await query(built.sql, built.params) : [];
    const count = spec.count ? rows.length : null;
    if (spec.op !== 'select' && !spec.returning) rows = null;
    if (spec.head) rows = null;
    if (spec.single && rows) {
      if (rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'Multiple rows returned' }, count };
      if (!rows.length && spec.single === 'single') return { data: null, error: { code: 'PGRST116', message: 'No rows returned' }, count };
      return { data: rows[0] || null, error: null, count };
    }
    return { data: rows, error: null, count };
  } catch (err) {
    return { data: null, error: { message: err.message || String(err), code: err.code || '' }, count: null };
  }
}

export function createDbClient() {
  return { from: (table) => new QueryBuilder(table) };
}

// ── Session tokens (HS256 JWT) ────────────────────────────────

const enc = new TextEncoder();

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function hmacKey() {
  const secret = env('AUTH_SECRET');
  if (secret.length < 32) throw new Error('AUTH_SECRET must be set (32+ chars)');
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function signJwt(payload) {
  const head = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), enc.encode(head + '.' + body));
  return head + '.' + body + '.' + b64url(new Uint8Array(sig));
}

async function verifyJwt(token, typ) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(), b64urlDecode(parts[2]), enc.encode(parts[0] + '.' + parts[1]));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
    if (!payload || payload.typ !== typ) return null;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch (_err) {
    return null;
  }
}

/** Supabase-shaped session object, so the browser code keeps working. */
export async function issueSession(user) {
  const now = Math.floor(Date.now() / 1000);
  const base = { sub: user.id, email: user.email || '' };
  return {
    access_token: await signJwt({ ...base, typ: 'access', iat: now, exp: now + ACCESS_TTL_SECONDS }),
    refresh_token: await signJwt({ ...base, typ: 'refresh', iat: now, exp: now + REFRESH_TTL_SECONDS }),
    token_type: 'bearer',
    expires_in: ACCESS_TTL_SECONDS,
    expires_at: now + ACCESS_TTL_SECONDS,
    user: { id: user.id, email: user.email || '' }
  };
}

export async function verifySessionToken(accessToken) {
  if (!accessToken || !env('AUTH_SECRET')) return null;
  const payload = await verifyJwt(accessToken, 'access');
  return payload ? { id: payload.sub, email: payload.email } : null;
}

export async function refreshSession(refreshToken) {
  const payload = await verifyJwt(refreshToken, 'refresh');
  return payload ? issueSession({ id: payload.sub, email: payload.email }) : null;
}

export async function resolveOwnerId() {
  const explicit = env('HOMER_OWNER_ID');
  if (explicit) return explicit;
  if (cachedOwnerId) return cachedOwnerId;
  if (!isDbConfigured()) return '';
  try {
    const rows = await query('SELECT id FROM users WHERE lower(email) = $1 LIMIT 1', [RESERVED_SYNC_EMAIL]);
    cachedOwnerId = rows[0] ? String(rows[0].id) : '';
    return cachedOwnerId;
  } catch (_err) {
    return '';
  }
}

export function ownerEmail() {
  return env('HOMER_OWNER_EMAIL') || RESERVED_SYNC_EMAIL;
}

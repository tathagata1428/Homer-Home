import crypto from 'crypto';
import { verifySupabaseJwt, createAdminClient, isSupabaseConfigured, resolveSupabaseOwnerId } from '../../lib/supabase-server.js';
import { isReservedSyncHash } from '../../lib/joey-server.js';

const BACKUP_MANIFEST_KEY = 'homer-backup-manifest';
const FIELD_OP_BATCH_LIMIT = 100;
const FIELD_OP_FETCH_LIMIT_MAX = 200;
const FIELD_OP_RETAIN_MAX = 80;
const FIELD_OP_PRUNE_BATCH = 200;
const FIELD_OP_PRUNE_INTERVAL = 5;

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  var output = {};
  Object.keys(value).sort().forEach(function (key) {
    output[key] = sortValue(value[key]);
  });
  return output;
}

function hashKey(passphrase) {
  return 'homer:' + crypto.createHash('sha256').update(passphrase).digest('hex');
}

function dataHash(data) {
  return crypto.createHash('sha256').update(JSON.stringify(sortValue(data))).digest('hex');
}

function getFieldSyncKeys(hk) {
  return {
    seq: hk + ':field_ops:seq',
    min: hk + ':field_ops:min',
    state: hk + ':field_ops:state',
    opPrefix: hk + ':field_op:'
  };
}

function parseHashResult(raw) {
  if (!Array.isArray(raw)) return {};
  var result = {};
  for (var index = 0; index < raw.length; index += 2) {
    var key = raw[index];
    if (key == null) continue;
    result[String(key)] = raw[index + 1];
  }
  return result;
}

function safeJsonParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function normalizeFieldValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function normalizeFieldOp(input, fallbackDeviceId) {
  var source = input && typeof input === 'object' ? input : {};
  var fieldId = String(source.fieldId || '').trim();
  if (!fieldId) return null;
  var kind = String(source.kind || 'text').trim().toLowerCase();
  var value = normalizeFieldValue(source.value);
  var deleted = !!source.deleted;
  if (deleted && (kind === 'checkbox' || kind === 'radio')) deleted = false;
  return {
    fieldId: fieldId.slice(0, 220),
    kind: kind.slice(0, 40) || 'text',
    value: value.slice(0, 500000),
    deleted: deleted,
    clientTs: Number(source.clientTs || 0) || 0,
    clientSeq: Math.max(0, Number(source.clientSeq || 0) || 0),
    source: String(source.source || 'field-input').slice(0, 80),
    scope: String(source.scope || 'local').slice(0, 40),
    deviceId: String(source.deviceId || fallbackDeviceId || '').slice(0, 120)
  };
}

async function loadFieldStateRecord(redis, key, fieldId) {
  if (!fieldId) return null;
  var response = await redis(['HGET', key, fieldId]);
  return safeJsonParse(response && response.result, null);
}

function compareFieldPriority(existing, incoming) {
  if (!incoming || !incoming.fieldId) return -1;
  if (!existing || !existing.fieldId) return 1;
  var incomingClientTs = Number(incoming.clientTs || 0) || 0;
  var existingClientTs = Number(existing.clientTs || 0) || 0;
  if (incomingClientTs !== existingClientTs) return incomingClientTs > existingClientTs ? 1 : -1;
  var incomingClientSeq = Math.max(0, Number(incoming.clientSeq || 0) || 0);
  var existingClientSeq = Math.max(0, Number(existing.clientSeq || 0) || 0);
  if (incoming.deviceId && existing.deviceId && incoming.deviceId === existing.deviceId && incomingClientSeq !== existingClientSeq) {
    return incomingClientSeq > existingClientSeq ? 1 : -1;
  }
  var samePayload =
    String(incoming.value || '') === String(existing.value || '') &&
    String(incoming.kind || '') === String(existing.kind || '') &&
    !!incoming.deleted === !!existing.deleted &&
    String(incoming.deviceId || '') === String(existing.deviceId || '') &&
    incomingClientSeq === existingClientSeq;
  if (samePayload) return 0;
  if (incomingClientSeq !== existingClientSeq) return incomingClientSeq > existingClientSeq ? 1 : -1;
  var incomingDeviceId = String(incoming.deviceId || '');
  var existingDeviceId = String(existing.deviceId || '');
  if (incomingDeviceId && existingDeviceId && incomingDeviceId !== existingDeviceId) {
    return incomingDeviceId > existingDeviceId ? 1 : -1;
  }
  return 0;
}

async function loadFieldState(redis, key) {
  var response = await redis(['HGETALL', key]);
  var rawEntries = parseHashResult(response && response.result);
  var state = {};
  Object.keys(rawEntries).forEach(function (fieldId) {
    var parsed = safeJsonParse(rawEntries[fieldId], null);
    if (parsed && parsed.fieldId) state[fieldId] = parsed;
  });
  return state;
}

async function persistFieldOp(redis, hk, op, deviceId) {
  var keys = getFieldSyncKeys(hk);
  var normalized = normalizeFieldOp(op, deviceId);
  if (!normalized) return null;
  var current = await loadFieldStateRecord(redis, keys.state, normalized.fieldId);
  var freshness = compareFieldPriority(current, normalized);
  if (freshness < 0) {
    return {
      rejected: true,
      stale: true,
      fieldId: normalized.fieldId,
      current: current || null,
      incoming: normalized
    };
  }
  if (freshness === 0 && current) {
    return {
      duplicate: true,
      fieldId: normalized.fieldId,
      current: current,
      incoming: normalized
    };
  }
  var versionResponse = await redis(['INCR', keys.seq]);
  var version = Number(versionResponse && versionResponse.result) || 0;
  if (!version) throw new Error('Could not allocate field op version');
  var serverTs = Date.now();
  var record = {
    ...normalized,
    version: version,
    serverTs: serverTs,
    updatedAt: new Date(serverTs).toISOString()
  };
  var serialized = JSON.stringify(record);
  await Promise.all([
    redis(['SET', keys.opPrefix + version, serialized]),
    redis(['HSET', keys.state, normalized.fieldId, serialized])
  ]);
  return record;
}

async function pruneFieldOps(redis, hk, latestVersion) {
  var keys = getFieldSyncKeys(hk);
  if (!latestVersion || latestVersion <= FIELD_OP_RETAIN_MAX) {
    if (latestVersion === 1) {
      await redis(['SET', keys.min, '1']);
    }
    return { deleted: 0, minRetainedVersion: 1 };
  }
  if ((latestVersion % FIELD_OP_PRUNE_INTERVAL) !== 0) {
    var existingMinRes = await redis(['GET', keys.min]);
    var existingMin = Math.max(1, parseInt((existingMinRes && existingMinRes.result) || '1', 10) || 1);
    return { deleted: 0, minRetainedVersion: existingMin };
  }
  var minResponse = await redis(['GET', keys.min]);
  var currentMin = Math.max(1, parseInt((minResponse && minResponse.result) || '1', 10) || 1);
  var pruneBefore = Math.max(0, latestVersion - FIELD_OP_RETAIN_MAX);
  if (pruneBefore < currentMin) {
    return { deleted: 0, minRetainedVersion: currentMin };
  }
  var deleted = 0;
  for (var start = currentMin; start <= pruneBefore; start += FIELD_OP_PRUNE_BATCH) {
    var end = Math.min(pruneBefore, start + FIELD_OP_PRUNE_BATCH - 1);
    var deleteKeys = ['DEL'];
    for (var version = start; version <= end; version += 1) {
      deleteKeys.push(keys.opPrefix + version);
    }
    if (deleteKeys.length > 1) {
      await redis(deleteKeys);
      deleted += deleteKeys.length - 1;
    }
  }
  var nextMin = pruneBefore + 1;
  await redis(['SET', keys.min, String(nextMin)]);
  return { deleted: deleted, minRetainedVersion: nextMin };
}

async function fetchFieldOps(redis, hk, since, limit) {
  var keys = getFieldSyncKeys(hk);
  var responses = await Promise.all([
    redis(['GET', keys.seq]),
    redis(['GET', keys.min])
  ]);
  var latestResponse = responses[0];
  var minResponse = responses[1];
  var latestVersion = parseInt((latestResponse && latestResponse.result) || '0', 10) || 0;
  var minRetainedVersion = Math.max(1, parseInt((minResponse && minResponse.result) || '1', 10) || 1);
  if (!latestVersion || latestVersion <= since) {
    return { latestVersion: latestVersion, minRetainedVersion: minRetainedVersion, ops: [], hasMore: false, resetToState: false };
  }
  if (since && since < (minRetainedVersion - 1)) {
    return {
      latestVersion: latestVersion,
      minRetainedVersion: minRetainedVersion,
      ops: [],
      hasMore: false,
      resetToState: true,
      hasGap: true
    };
  }
  var upper = Math.min(latestVersion, since + limit);
  var redisKeys = [];
  for (var v = since + 1; v <= upper; v += 1) {
    redisKeys.push(keys.opPrefix + v);
  }
  var response = await redis(['MGET'].concat(redisKeys));
  var rawOps = Array.isArray(response && response.result) ? response.result : [];
  var ops = [];
  var hasGap = false;
  rawOps.forEach(function (raw) {
    if (raw == null) {
      hasGap = true;
      return;
    }
    var parsed = safeJsonParse(raw, null);
    if (parsed && parsed.fieldId) ops.push(parsed);
    else hasGap = true;
  });
  ops.sort(function (a, b) { return (a.version || 0) - (b.version || 0); });
  return {
    latestVersion: latestVersion,
    minRetainedVersion: minRetainedVersion,
    ops: ops,
    hasMore: latestVersion > upper,
    hasGap: hasGap,
    resetToState: hasGap
  };
}

// ── Supabase field-state helpers ───────────────────────────────────────────

async function sbFieldState(userId) {
  var supabase = createAdminClient();
  var { data, error } = await supabase
    .from('field_state')
    .select('field_id,kind,value,deleted,client_ts,client_seq,device_id,server_ts')
    .eq('user_id', userId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  var state = {};
  (data || []).forEach(function(row) {
    state[row.field_id] = {
      fieldId: row.field_id, kind: row.kind, value: row.value,
      deleted: row.deleted, clientTs: row.client_ts, clientSeq: row.client_seq,
      deviceId: row.device_id, serverTs: row.server_ts, version: row.server_ts
    };
  });
  return Response.json({ ok: true, latestVersion: Date.now(), state: state });
}

async function sbFieldOps(userId, since) {
  var supabase = createAdminClient();
  var query = supabase
    .from('field_state')
    .select('field_id,kind,value,deleted,client_ts,client_seq,device_id,server_ts')
    .eq('user_id', userId);
  if (since > 0) query = query.gt('server_ts', since);
  var { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  var ops = (data || []).map(function(row) {
    return {
      fieldId: row.field_id, kind: row.kind, value: row.value,
      deleted: row.deleted, clientTs: row.client_ts, clientSeq: row.client_seq,
      deviceId: row.device_id, serverTs: row.server_ts, version: row.server_ts
    };
  });
  var latestTs = ops.length ? Math.max.apply(null, ops.map(function(op){ return op.serverTs || 0; })) : since;
  return Response.json({
    ok: true, since: since,
    latestVersion: latestTs || Date.now(),
    minRetainedVersion: 0, hasMore: false, hasGap: false, resetToState: false,
    ops: ops
  });
}

async function sbApplyFieldOps(userId, body) {
  var ops = Array.isArray(body.ops) ? body.ops : [];
  if (!ops.length) return Response.json({ error: 'Missing ops' }, { status: 400 });
  var supabase = createAdminClient();
  var serverTs = Date.now();
  var fieldIds = ops.map(function(op){ return op && op.fieldId; }).filter(Boolean);
  var currentMap = {};
  if (fieldIds.length) {
    var { data: rows } = await supabase
      .from('field_state')
      .select('field_id,client_ts,client_seq,device_id,value,kind,deleted')
      .eq('user_id', userId)
      .in('field_id', fieldIds);
    (rows || []).forEach(function(row) {
      currentMap[row.field_id] = {
        fieldId: row.field_id, clientTs: row.client_ts, clientSeq: row.client_seq,
        deviceId: row.device_id, value: row.value, kind: row.kind, deleted: row.deleted
      };
    });
  }
  var applied = [], rejected = [], duplicates = [], upserts = [];
  for (var i = 0; i < ops.length; i++) {
    var normalized = normalizeFieldOp(ops[i], body.deviceId);
    if (!normalized) continue;
    var current = currentMap[normalized.fieldId] || null;
    var freshness = compareFieldPriority(current, normalized);
    if (freshness < 0) { rejected.push({ rejected:true, stale:true, fieldId:normalized.fieldId, current:current, incoming:normalized }); continue; }
    if (freshness === 0 && current) { duplicates.push({ duplicate:true, fieldId:normalized.fieldId, current:current, incoming:normalized }); continue; }
    upserts.push({
      user_id: userId, field_id: normalized.fieldId, kind: normalized.kind,
      value: normalized.value, deleted: normalized.deleted,
      client_ts: normalized.clientTs, client_seq: normalized.clientSeq,
      device_id: normalized.deviceId || '', server_ts: serverTs,
      updated_at: new Date(serverTs).toISOString()
    });
    applied.push(Object.assign({}, normalized, { version: serverTs, serverTs: serverTs }));
  }
  if (upserts.length) {
    var { error } = await supabase.from('field_state').upsert(upserts, { onConflict: 'user_id,field_id' });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({
    ok: true, applied: applied, rejected: rejected, duplicates: duplicates,
    latestVersion: serverTs, minRetainedVersion: 0, prunedOps: 0
  });
}

// ── CF Pages Function ──────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;
  if (env && typeof env === 'object') {
    Object.assign(process.env, env);
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams;

  // ── Supabase JWT auth ──────────────────────────────────────────────────
  const authHeader = String(request.headers.get('authorization') || '');
  const jwtToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  let supabaseUser = null;
  if (jwtToken && isSupabaseConfigured()) {
    supabaseUser = await verifySupabaseJwt(jwtToken);
  }

  // Route Supabase-authenticated field-sync requests
  if (supabaseUser) {
    try {
      if (request.method === 'GET') {
        const sbAction = searchParams.get('action') || 'latest';
        if (sbAction === 'field-state') {
          return addCors(await sbFieldState(supabaseUser.id), corsHeaders);
        }
        if (sbAction === 'field-ops') {
          const since = parseInt(searchParams.get('since') || '0', 10) || 0;
          return addCors(await sbFieldOps(supabaseUser.id, since), corsHeaders);
        }
        if (sbAction === 'status') {
          return addCors(Response.json({ ok: true, exists: true, ts: Date.now(), fieldVersion: Date.now() }), corsHeaders);
        }
      }
      if (request.method === 'POST') {
        const sbBody = await request.json().catch(() => ({}));
        if (sbBody && sbBody.action === 'field-op') {
          return addCors(await sbApplyFieldOps(supabaseUser.id, sbBody), corsHeaders);
        }
      }
    } catch (sbErr) {
      return addCors(Response.json({ error: sbErr.message || 'Supabase error' }, { status: 500 }), corsHeaders);
    }
  }

  // Parse body for POST (once, before reserved-key check)
  let maybeBody = null;
  if (request.method === 'POST') {
    try { maybeBody = await request.json(); } catch (e) { maybeBody = {}; }
  }

  const reservedKey = String(
    request.method === 'GET'
      ? (searchParams.get('key') || '')
      : (maybeBody && maybeBody.key) || ''
  ).trim();

  if (!supabaseUser && isSupabaseConfigured() && isReservedSyncHash(reservedKey)) {
    try {
      const reservedOwnerId = await resolveSupabaseOwnerId();
      if (reservedOwnerId) {
        if (request.method === 'GET') {
          const reservedAction = searchParams.get('action') || 'latest';
          if (reservedAction === 'field-state') {
            return addCors(await sbFieldState(reservedOwnerId), corsHeaders);
          }
          if (reservedAction === 'field-ops') {
            const since = parseInt(searchParams.get('since') || '0', 10) || 0;
            return addCors(await sbFieldOps(reservedOwnerId, since), corsHeaders);
          }
          if (reservedAction === 'status') {
            return addCors(Response.json({ ok: true, exists: true, ts: Date.now(), fieldVersion: Date.now() }), corsHeaders);
          }
        }
        if (request.method === 'POST') {
          const reservedPostAction = (maybeBody && maybeBody.action) || searchParams.get('action') || '';
          if (reservedPostAction === 'field-op') {
            return addCors(await sbApplyFieldOps(reservedOwnerId, maybeBody || {}), corsHeaders);
          }
        }
      }
    } catch (reservedErr) {
      return addCors(Response.json({ error: reservedErr.message || 'Supabase error' }, { status: 500 }), corsHeaders);
    }
  }

  // ── Admin-hash passphrase → Supabase field sync (no Redis needed) ─────
  if (!supabaseUser && isSupabaseConfigured() && reservedKey) {
    const adminHash = String(process.env.HOMER_ADMIN_HASH || '').trim();
    if (adminHash && reservedKey === adminHash) {
      try {
        const adminOwnerId = await resolveSupabaseOwnerId();
        if (adminOwnerId) {
          if (request.method === 'GET') {
            const adminAction = searchParams.get('action') || 'latest';
            if (adminAction === 'field-state') return addCors(await sbFieldState(adminOwnerId), corsHeaders);
            if (adminAction === 'field-ops') {
              const since = parseInt(searchParams.get('since') || '0', 10) || 0;
              return addCors(await sbFieldOps(adminOwnerId, since), corsHeaders);
            }
            if (adminAction === 'status') return addCors(Response.json({ ok: true, exists: true, ts: Date.now(), fieldVersion: Date.now() }), corsHeaders);
          }
          if (request.method === 'POST') {
            const adminPostAction = (maybeBody && maybeBody.action) || searchParams.get('action') || '';
            if (adminPostAction === 'field-op') return addCors(await sbApplyFieldOps(adminOwnerId, maybeBody || {}), corsHeaders);
          }
        }
      } catch (adminErr) {
        return addCors(Response.json({ error: adminErr.message || 'Supabase error' }, { status: 500 }), corsHeaders);
      }
    }
  }

  // ── Redis fallback ─────────────────────────────────────────────────────
  const REDIS_URL = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;

  if (!REDIS_URL || !REDIS_TOKEN) {
    return addCors(Response.json({ error: 'Redis not configured' }, { status: 500 }), corsHeaders);
  }

  const MAX_VERSIONS = 1;

  function parseManifest(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
    if (!snapshot[BACKUP_MANIFEST_KEY]) return null;
    try {
      var parsed = JSON.parse(snapshot[BACKUP_MANIFEST_KEY]);
      if (parsed && Array.isArray(parsed.localStorage) && Array.isArray(parsed.indexedDb)) return parsed;
    } catch (e) {}
    return null;
  }

  function inspectSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return { ok: false, reason: 'Snapshot is not an object', legacy: false, manifest: null };
    }
    var keys = Object.keys(snapshot);
    if (!keys.length) {
      return { ok: false, reason: 'Snapshot is empty', legacy: false, manifest: null };
    }
    var manifest = parseManifest(snapshot);
    if (!manifest) {
      return { ok: true, legacy: true, reason: 'Snapshot has no backup manifest', manifest: null, keyCount: keys.length };
    }
    var missingLocal = manifest.localStorage.filter(function (k) { return !(k in snapshot); });
    var missingIdb = manifest.indexedDb.filter(function (k) { return !(k in snapshot); });
    if (missingLocal.length || missingIdb.length) {
      return {
        ok: false, legacy: false,
        reason: 'Snapshot manifest does not match stored keys',
        manifest, missingLocal, missingIdb, keyCount: keys.length
      };
    }
    return { ok: true, legacy: false, manifest, keyCount: keys.length };
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function readJsonKey(redis, key, retries, delayMs) {
    var attempts = Math.max(1, Number(retries || 0) + 1);
    var delay = Math.max(0, Number(delayMs || 0) || 0);
    for (var attempt = 0; attempt < attempts; attempt += 1) {
      var result = await redis(['GET', key]);
      if (result && result.result) return JSON.parse(result.result);
      if (attempt < attempts - 1 && delay > 0) await wait(delay);
    }
    return null;
  }

  async function verifyStoredSnapshot(redis, key, expectedHash) {
    var stored = await readJsonKey(redis, key, 40, 400);
    if (!stored) return { ok: false, reason: 'Stored snapshot missing after write' };
    var inspected = inspectSnapshot(stored);
    if (!inspected.ok) return { ok: false, reason: inspected.reason, integrity: inspected };
    var storedHash = dataHash(stored);
    if (storedHash !== expectedHash) {
      return { ok: false, reason: 'Stored snapshot hash mismatch after write', integrity: inspected, storedHash };
    }
    return { ok: true, integrity: inspected, storedHash };
  }

  async function findLatestHealthyVersion(redis, hk, versions) {
    var list = Array.isArray(versions) ? versions.slice().reverse() : [];
    for (var i = 0; i < list.length; i += 1) {
      var entry = list[i];
      if (!entry || !entry.ts) continue;
      var versionData = await readJsonKey(redis, hk + ':v:' + entry.ts);
      if (!versionData) continue;
      var integrity = inspectSnapshot(versionData);
      if (!integrity.ok) continue;
      if (entry.dataHash && entry.dataHash !== dataHash(versionData)) continue;
      return { ts: entry.ts, data: versionData, integrity, dataHash: entry.dataHash || dataHash(versionData) };
    }
    return null;
  }

  async function redis(cmd) {
    var r = await fetch(REDIS_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN },
      body: JSON.stringify(cmd)
    });
    return r.json();
  }

  try {
    if (request.method === 'GET') {
      const key = searchParams.get('key');
      if (!key) return addCors(Response.json({ error: 'Missing key' }, { status: 400 }), corsHeaders);

      const action = searchParams.get('action') || 'latest';
      const hk = hashKey(key);
      const fieldKeys = getFieldSyncKeys(hk);

      if (action === 'field-ops') {
        const since = Math.max(0, parseInt(searchParams.get('since') || '0', 10) || 0);
        const limit = Math.min(FIELD_OP_FETCH_LIMIT_MAX, Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100));
        const fieldOps = await fetchFieldOps(redis, hk, since, limit);
        return addCors(Response.json({
          ok: true,
          since: since,
          latestVersion: fieldOps.latestVersion,
          minRetainedVersion: fieldOps.minRetainedVersion,
          hasMore: fieldOps.hasMore,
          hasGap: !!fieldOps.hasGap,
          resetToState: !!fieldOps.resetToState,
          ops: fieldOps.ops
        }), corsHeaders);
      }

      if (action === 'field-state') {
        const latestFieldVersionRes = await redis(['GET', fieldKeys.seq]);
        const state = await loadFieldState(redis, fieldKeys.state);
        return addCors(Response.json({
          ok: true,
          latestVersion: parseInt((latestFieldVersionRes && latestFieldVersionRes.result) || '0', 10) || 0,
          state: state
        }), corsHeaders);
      }

      if (action === 'status') {
        const syncMetaRes = await redis(['GET', hk + ':meta']);
        const syncMeta = syncMetaRes.result ? JSON.parse(syncMetaRes.result) : null;
        const latestFieldVersionStatusRes = await redis(['GET', fieldKeys.seq]);
        return addCors(Response.json({
          ok: true,
          exists: !!syncMeta,
          ts: syncMeta && syncMeta.lastTs ? syncMeta.lastTs : null,
          dataHash: syncMeta && syncMeta.lastDataHash ? syncMeta.lastDataHash : null,
          versionCount: syncMeta && Array.isArray(syncMeta.versions) ? syncMeta.versions.length : 0,
          fieldVersion: parseInt((latestFieldVersionStatusRes && latestFieldVersionStatusRes.result) || '0', 10) || 0
        }), corsHeaders);
      }

      if (action === 'versions') {
        const metaResult = await redis(['GET', hk + ':meta']);
        const meta = metaResult.result ? JSON.parse(metaResult.result) : null;
        if (!meta) return addCors(Response.json({ versions: [] }), corsHeaders);
        return addCors(Response.json({ versions: meta.versions || [] }), corsHeaders);
      }

      if (action === 'restore-version') {
        const ts = searchParams.get('ts');
        if (!ts) return addCors(Response.json({ error: 'Missing ts parameter' }, { status: 400 }), corsHeaders);
        const vResult = await redis(['GET', hk + ':v:' + ts]);
        const versionMetaRes = await redis(['GET', hk + ':meta']);
        if (!vResult.result) {
          return addCors(Response.json({ error: 'Version not found' }, { status: 404 }), corsHeaders);
        }
        const versionData = JSON.parse(vResult.result);
        const versionInspection = inspectSnapshot(versionData);
        if (!versionInspection.ok) {
          return addCors(Response.json({ error: 'Stored version is corrupted', integrity: versionInspection, ts: parseInt(ts) }, { status: 409 }), corsHeaders);
        }
        if (!versionInspection.legacy && versionMetaRes.result) {
          const versionMeta = (JSON.parse(versionMetaRes.result).versions || []).find(function (entry) { return String(entry.ts) === String(ts); });
          if (versionMeta && versionMeta.dataHash && versionMeta.dataHash !== dataHash(versionData)) {
            return addCors(Response.json({ error: 'Stored version failed integrity check', integrity: versionInspection, ts: parseInt(ts) }, { status: 409 }), corsHeaders);
          }
        }
        return addCors(Response.json({ data: versionData, ts: parseInt(ts), integrity: versionInspection }), corsHeaders);
      }

      // Default: return latest backup
      const result = await redis(['GET', hk]);
      if (!result.result) {
        return addCors(Response.json({ error: 'No backup found for this passphrase' }, { status: 404 }), corsHeaders);
      }

      const metaRes = await redis(['GET', hk + ':meta']);
      const metaData = metaRes.result ? JSON.parse(metaRes.result) : {};

      const latestData = JSON.parse(result.result);
      const latestIntegrity = inspectSnapshot(latestData);
      const latestHashMatches = !metaData.lastDataHash || metaData.lastDataHash === dataHash(latestData);
      if (!latestIntegrity.ok || !latestHashMatches) {
        const recoveredVersion = await findLatestHealthyVersion(redis, hk, metaData.versions || []);
        if (!recoveredVersion) {
          return addCors(Response.json({
            error: !latestIntegrity.ok ? 'Stored backup is corrupted' : 'Stored backup failed integrity check',
            integrity: latestIntegrity
          }, { status: 409 }), corsHeaders);
        }
        return addCors(Response.json({
          data: recoveredVersion.data,
          ts: recoveredVersion.ts,
          dataHash: recoveredVersion.dataHash,
          versionCount: metaData.versions ? metaData.versions.length : 0,
          integrity: recoveredVersion.integrity,
          verified: !recoveredVersion.integrity.legacy,
          recoveredFromVersion: recoveredVersion.ts
        }), corsHeaders);
      }

      return addCors(Response.json({
        data: latestData,
        ts: metaData.lastTs || null,
        dataHash: metaData.lastDataHash || null,
        versionCount: metaData.versions ? metaData.versions.length : 0,
        integrity: latestIntegrity,
        verified: !latestIntegrity.legacy
      }), corsHeaders);
    }

    if (request.method === 'POST') {
      const body = maybeBody || {};
      const postAction = body.action || searchParams.get('action') || '';
      if (!body.key) return addCors(Response.json({ error: 'Missing key' }, { status: 400 }), corsHeaders);
      const hk = hashKey(body.key);

      if (postAction === 'field-op') {
        const ops = Array.isArray(body.ops) ? body.ops : [];
        if (!ops.length) return addCors(Response.json({ error: 'Missing ops' }, { status: 400 }), corsHeaders);
        if (ops.length > FIELD_OP_BATCH_LIMIT) return addCors(Response.json({ error: 'Too many ops in one request' }, { status: 400 }), corsHeaders);
        const applied = [];
        const rejected = [];
        const duplicates = [];
        for (let opIndex = 0; opIndex < ops.length; opIndex += 1) {
          const record = await persistFieldOp(redis, hk, ops[opIndex], body.deviceId);
          if (!record) continue;
          if (record.rejected) rejected.push(record);
          else if (record.duplicate) duplicates.push(record);
          else applied.push(record);
        }
        let latestFieldVersion = applied.length ? applied[applied.length - 1].version : 0;
        if (!latestFieldVersion) {
          const latestFieldVersionRes = await redis(['GET', getFieldSyncKeys(hk).seq]);
          latestFieldVersion = parseInt((latestFieldVersionRes && latestFieldVersionRes.result) || '0', 10) || 0;
        }
        const pruneResult = await pruneFieldOps(redis, hk, latestFieldVersion);
        return addCors(Response.json({
          ok: true,
          applied: applied,
          rejected: rejected,
          duplicates: duplicates,
          latestVersion: latestFieldVersion,
          minRetainedVersion: pruneResult.minRetainedVersion,
          prunedOps: pruneResult.deleted
        }), corsHeaders);
      }

      if (!body.data) return addCors(Response.json({ error: 'Missing data' }, { status: 400 }), corsHeaders);

      const incomingIntegrity = inspectSnapshot(body.data);
      if (!incomingIntegrity.ok) {
        return addCors(Response.json({ error: 'Invalid backup snapshot', integrity: incomingIntegrity }, { status: 400 }), corsHeaders);
      }

      const now = Date.now();
      const newDataHash = dataHash(body.data);

      const metaRes = await redis(['GET', hk + ':meta']);
      let meta = metaRes.result ? JSON.parse(metaRes.result) : { versions: [] };

      if (meta.lastDataHash === newDataHash) {
        const currentLatestVerify = await verifyStoredSnapshot(redis, hk, newDataHash);
        if (!currentLatestVerify.ok) {
          meta.lastDataHash = null;
        } else {
          meta.lastTs = now;
          await redis(['SET', hk + ':meta', JSON.stringify(meta)]);
          const verifiedSkipMeta = await readJsonKey(redis, hk + ':meta', 8, 250);
          if (!verifiedSkipMeta || verifiedSkipMeta.lastTs !== now) {
            return addCors(Response.json({ error: 'Backup metadata verification failed after unchanged write' }, { status: 500 }), corsHeaders);
          }
          return addCors(Response.json({
            ok: true,
            ts: now,
            skipped: true,
            reason: 'Data unchanged',
            dataHash: newDataHash,
            versionCount: meta.versions.length,
            verified: true,
            integrity: currentLatestVerify.integrity || incomingIntegrity
          }), corsHeaders);
        }
      }

      const dataStr = JSON.stringify(body.data);

      await redis(['SET', hk + ':v:' + now, dataStr]);
      const versionVerify = await verifyStoredSnapshot(redis, hk + ':v:' + now, newDataHash);
      if (!versionVerify.ok) {
        return addCors(Response.json({
          error: versionVerify.reason || 'Version snapshot verification failed',
          integrity: versionVerify.integrity || null
        }, { status: 500 }), corsHeaders);
      }

      await redis(['SET', hk, dataStr]);
      const latestVerify = await verifyStoredSnapshot(redis, hk, newDataHash);
      if (!latestVerify.ok) {
        return addCors(Response.json({
          error: latestVerify.reason || 'Latest snapshot verification failed',
          integrity: latestVerify.integrity || null
        }, { status: 500 }), corsHeaders);
      }

      meta.versions.push({
        ts: now,
        dataHash: newDataHash,
        size: dataStr.length,
        keyCount: Object.keys(body.data).length,
        verified: true,
        legacy: !!incomingIntegrity.legacy
      });

      if (meta.versions.length > MAX_VERSIONS) {
        const toRemove = meta.versions.splice(0, meta.versions.length - MAX_VERSIONS);
        for (let i = 0; i < toRemove.length; i++) {
          await redis(['DEL', hk + ':v:' + toRemove[i].ts]);
        }
      }

      meta.lastTs = now;
      meta.lastDataHash = newDataHash;

      await redis(['SET', hk + ':meta', JSON.stringify(meta)]);
      const verifiedMeta = await readJsonKey(redis, hk + ':meta', 8, 250);
      if (!verifiedMeta || verifiedMeta.lastDataHash !== newDataHash || verifiedMeta.lastTs !== now) {
        return addCors(Response.json({ error: 'Backup metadata verification failed' }, { status: 500 }), corsHeaders);
      }

      return addCors(Response.json({
        ok: true,
        ts: now,
        dataHash: newDataHash,
        versionCount: meta.versions.length,
        verified: true,
        integrity: incomingIntegrity
      }), corsHeaders);
    }

    return addCors(Response.json({ error: 'Method not allowed' }, { status: 405 }), corsHeaders);
  } catch (err) {
    return addCors(Response.json({ error: err.message || 'Unknown error' }, { status: 500 }), corsHeaders);
  }
}

function addCors(response, corsHeaders) {
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
  return new Response(response.body, { status: response.status, headers: newHeaders });
}

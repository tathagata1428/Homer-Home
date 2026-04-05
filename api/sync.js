import crypto from 'crypto';
import { verifySupabaseJwt, createAdminClient, isSupabaseConfigured, resolveSupabaseOwnerId } from '../lib/supabase-server.js';
import { isReservedSyncHash } from '../lib/joey-server.js';

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
  for (var version = since + 1; version <= upper; version += 1) {
    redisKeys.push(keys.opPrefix + version);
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

async function sbFieldState(userId, res) {
  var supabase = createAdminClient();
  var { data, error } = await supabase
    .from('field_state')
    .select('field_id,kind,value,deleted,client_ts,client_seq,device_id,server_ts')
    .eq('user_id', userId);
  if (error) return res.status(500).json({ error: error.message });
  var state = {};
  (data || []).forEach(function(row) {
    state[row.field_id] = {
      fieldId: row.field_id, kind: row.kind, value: row.value,
      deleted: row.deleted, clientTs: row.client_ts, clientSeq: row.client_seq,
      deviceId: row.device_id, serverTs: row.server_ts, version: row.server_ts
    };
  });
  return res.status(200).json({ ok: true, latestVersion: Date.now(), state: state });
}

async function sbFieldOps(userId, req, res) {
  var since = parseInt(req.query.since || '0', 10) || 0;
  var supabase = createAdminClient();
  var query = supabase
    .from('field_state')
    .select('field_id,kind,value,deleted,client_ts,client_seq,device_id,server_ts')
    .eq('user_id', userId);
  if (since > 0) query = query.gt('server_ts', since);
  var { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  var ops = (data || []).map(function(row) {
    return {
      fieldId: row.field_id, kind: row.kind, value: row.value,
      deleted: row.deleted, clientTs: row.client_ts, clientSeq: row.client_seq,
      deviceId: row.device_id, serverTs: row.server_ts, version: row.server_ts
    };
  });
  var latestTs = ops.length ? Math.max.apply(null, ops.map(function(op){ return op.serverTs || 0; })) : since;
  return res.status(200).json({
    ok: true, since: since,
    latestVersion: latestTs || Date.now(),
    minRetainedVersion: 0, hasMore: false, hasGap: false, resetToState: false,
    ops: ops
  });
}

async function sbApplyFieldOps(userId, body, res) {
  var ops = Array.isArray(body.ops) ? body.ops : [];
  if (!ops.length) return res.status(400).json({ error: 'Missing ops' });
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
    if (error) return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({
    ok: true, applied: applied, rejected: rejected, duplicates: duplicates,
    latestVersion: serverTs, minRetainedVersion: 0, prunedOps: 0
  });
}

// ── HTTP handler ───────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Supabase JWT auth (bogdan only; non-bogdan stays localStorage) ──────
  var authHeader = String(req.headers.authorization || '');
  var jwtToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  var supabaseUser = null;
  if (jwtToken && isSupabaseConfigured()) {
    supabaseUser = await verifySupabaseJwt(jwtToken);
  }

  // Route Supabase-authenticated field-sync requests
  if (supabaseUser) {
    try {
      if (req.method === 'GET') {
        var sbAction = req.query.action || 'latest';
        if (sbAction === 'field-state') return sbFieldState(supabaseUser.id, res);
        if (sbAction === 'field-ops') return sbFieldOps(supabaseUser.id, req, res);
        // status: return lightweight info
        if (sbAction === 'status') {
          return res.status(200).json({ ok: true, exists: true, ts: Date.now(), fieldVersion: Date.now() });
        }
      }
      if (req.method === 'POST') {
        var sbBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        if (sbBody && sbBody.action === 'field-op') return sbApplyFieldOps(supabaseUser.id, sbBody, res);
      }
    } catch (sbErr) {
      return res.status(500).json({ error: sbErr.message || 'Supabase error' });
    }
  }

  var maybeBody = null;
  if (req.method === 'POST') {
    maybeBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  var reservedKey = String(
    req.method === 'GET'
      ? (req.query && req.query.key)
      : (maybeBody && maybeBody.key)
      || ''
  ).trim();
  if (!supabaseUser && isSupabaseConfigured() && isReservedSyncHash(reservedKey)) {
    try {
      var reservedOwnerId = await resolveSupabaseOwnerId();
      if (reservedOwnerId) {
        if (req.method === 'GET') {
          var reservedAction = req.query.action || 'latest';
          if (reservedAction === 'field-state') return sbFieldState(reservedOwnerId, res);
          if (reservedAction === 'field-ops') return sbFieldOps(reservedOwnerId, req, res);
          if (reservedAction === 'status') {
            return res.status(200).json({ ok: true, exists: true, ts: Date.now(), fieldVersion: Date.now() });
          }
        }
        if (req.method === 'POST') {
          var reservedPostAction = (maybeBody && maybeBody.action) || req.query.action || '';
          if (reservedPostAction === 'field-op') return sbApplyFieldOps(reservedOwnerId, maybeBody || {}, res);
        }
      }
    } catch (reservedErr) {
      return res.status(500).json({ error: reservedErr.message || 'Supabase error' });
    }
  }

  // ── Redis fallback (full backup snapshots + field-ops without JWT) ───────
  var REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  var REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  var MAX_VERSIONS = 1;

  function parseManifest(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
    if (!snapshot[BACKUP_MANIFEST_KEY]) return null;
    try {
      var parsed = JSON.parse(snapshot[BACKUP_MANIFEST_KEY]);
      if (parsed && Array.isArray(parsed.localStorage) && Array.isArray(parsed.indexedDb)) return parsed;
    } catch (error) {}
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
      return {
        ok: true,
        legacy: true,
        reason: 'Snapshot has no backup manifest',
        manifest: null,
        keyCount: keys.length
      };
    }

    var missingLocal = manifest.localStorage.filter(function (key) { return !(key in snapshot); });
    var missingIdb = manifest.indexedDb.filter(function (key) { return !(key in snapshot); });
    if (missingLocal.length || missingIdb.length) {
      return {
        ok: false,
        legacy: false,
        reason: 'Snapshot manifest does not match stored keys',
        manifest,
        missingLocal,
        missingIdb,
        keyCount: keys.length
      };
    }

    return {
      ok: true,
      legacy: false,
      manifest,
      keyCount: keys.length
    };
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
      return {
        ts: entry.ts,
        data: versionData,
        integrity,
        dataHash: entry.dataHash || dataHash(versionData)
      };
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
    if (req.method === 'GET') {
      var key = req.query.key;
      if (!key) return res.status(400).json({ error: 'Missing key' });

      var action = req.query.action || 'latest';
      var hk = hashKey(key);
      var fieldKeys = getFieldSyncKeys(hk);

      if (action === 'field-ops') {
        var since = Math.max(0, parseInt(req.query.since || '0', 10) || 0);
        var limit = Math.min(FIELD_OP_FETCH_LIMIT_MAX, Math.max(1, parseInt(req.query.limit || '100', 10) || 100));
        var fieldOps = await fetchFieldOps(redis, hk, since, limit);
        return res.status(200).json({
          ok: true,
          since: since,
          latestVersion: fieldOps.latestVersion,
          minRetainedVersion: fieldOps.minRetainedVersion,
          hasMore: fieldOps.hasMore,
          hasGap: !!fieldOps.hasGap,
          resetToState: !!fieldOps.resetToState,
          ops: fieldOps.ops
        });
      }

      if (action === 'field-state') {
        var latestFieldVersionRes = await redis(['GET', fieldKeys.seq]);
        var state = await loadFieldState(redis, fieldKeys.state);
        return res.status(200).json({
          ok: true,
          latestVersion: parseInt((latestFieldVersionRes && latestFieldVersionRes.result) || '0', 10) || 0,
          state: state
        });
      }

      if (action === 'status') {
        var syncMetaRes = await redis(['GET', hk + ':meta']);
        var syncMeta = syncMetaRes.result ? JSON.parse(syncMetaRes.result) : null;
        var latestFieldVersionStatusRes = await redis(['GET', fieldKeys.seq]);
        return res.status(200).json({
          ok: true,
          exists: !!syncMeta,
          ts: syncMeta && syncMeta.lastTs ? syncMeta.lastTs : null,
          dataHash: syncMeta && syncMeta.lastDataHash ? syncMeta.lastDataHash : null,
          versionCount: syncMeta && Array.isArray(syncMeta.versions) ? syncMeta.versions.length : 0,
          fieldVersion: parseInt((latestFieldVersionStatusRes && latestFieldVersionStatusRes.result) || '0', 10) || 0
        });
      }

      if (action === 'versions') {
        // Return version history metadata
        var metaResult = await redis(['GET', hk + ':meta']);
        var meta = metaResult.result ? JSON.parse(metaResult.result) : null;
        if (!meta) return res.status(200).json({ versions: [] });
        return res.status(200).json({ versions: meta.versions || [] });
      }

      if (action === 'restore-version') {
        // Restore a specific version by timestamp
        var ts = req.query.ts;
        if (!ts) return res.status(400).json({ error: 'Missing ts parameter' });
        var vResult = await redis(['GET', hk + ':v:' + ts]);
        var versionMetaRes = await redis(['GET', hk + ':meta']);
        if (!vResult.result) {
          return res.status(404).json({ error: 'Version not found' });
        }
        var versionData = JSON.parse(vResult.result);
        var versionInspection = inspectSnapshot(versionData);
        if (!versionInspection.ok) {
          return res.status(409).json({ error: 'Stored version is corrupted', integrity: versionInspection, ts: parseInt(ts) });
        }
        if (!versionInspection.legacy && versionMetaRes.result) {
          var versionMeta = (JSON.parse(versionMetaRes.result).versions || []).find(function (entry) { return String(entry.ts) === String(ts); });
          if (versionMeta && versionMeta.dataHash && versionMeta.dataHash !== dataHash(versionData)) {
            return res.status(409).json({ error: 'Stored version failed integrity check', integrity: versionInspection, ts: parseInt(ts) });
          }
        }
        return res.status(200).json({ data: versionData, ts: parseInt(ts), integrity: versionInspection });
      }

      // Default: return latest backup
      var result = await redis(['GET', hk]);
      if (!result.result) {
        return res.status(404).json({ error: 'No backup found for this passphrase' });
      }

      // Also get metadata for timestamp info
      var metaRes = await redis(['GET', hk + ':meta']);
      var metaData = metaRes.result ? JSON.parse(metaRes.result) : {};

      var latestData = JSON.parse(result.result);
      var latestIntegrity = inspectSnapshot(latestData);
      var latestHashMatches = !metaData.lastDataHash || metaData.lastDataHash === dataHash(latestData);
      if (!latestIntegrity.ok || !latestHashMatches) {
        var recoveredVersion = await findLatestHealthyVersion(redis, hk, metaData.versions || []);
        if (!recoveredVersion) {
          return res.status(409).json({
            error: !latestIntegrity.ok ? 'Stored backup is corrupted' : 'Stored backup failed integrity check',
            integrity: latestIntegrity
          });
        }
        return res.status(200).json({
          data: recoveredVersion.data,
          ts: recoveredVersion.ts,
          dataHash: recoveredVersion.dataHash,
          versionCount: metaData.versions ? metaData.versions.length : 0,
          integrity: recoveredVersion.integrity,
          verified: !recoveredVersion.integrity.legacy,
          recoveredFromVersion: recoveredVersion.ts
        });
      }

      return res.status(200).json({
        data: latestData,
        ts: metaData.lastTs || null,
        dataHash: metaData.lastDataHash || null,
        versionCount: metaData.versions ? metaData.versions.length : 0,
        integrity: latestIntegrity,
        verified: !latestIntegrity.legacy
      });
    }

    if (req.method === 'POST') {
      var body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      var postAction = body.action || req.query.action || '';
      if (!body.key) return res.status(400).json({ error: 'Missing key' });
      var hk = hashKey(body.key);

      if (postAction === 'field-op') {
        var ops = Array.isArray(body.ops) ? body.ops : [];
        if (!ops.length) return res.status(400).json({ error: 'Missing ops' });
        if (ops.length > FIELD_OP_BATCH_LIMIT) return res.status(400).json({ error: 'Too many ops in one request' });
        var applied = [];
        var rejected = [];
        var duplicates = [];
        for (var opIndex = 0; opIndex < ops.length; opIndex += 1) {
          var record = await persistFieldOp(redis, hk, ops[opIndex], body.deviceId);
          if (!record) continue;
          if (record.rejected) rejected.push(record);
          else if (record.duplicate) duplicates.push(record);
          else applied.push(record);
        }
        var latestFieldVersion = applied.length ? applied[applied.length - 1].version : 0;
        if (!latestFieldVersion) {
          var latestFieldVersionRes = await redis(['GET', getFieldSyncKeys(hk).seq]);
          latestFieldVersion = parseInt((latestFieldVersionRes && latestFieldVersionRes.result) || '0', 10) || 0;
        }
        var pruneResult = await pruneFieldOps(redis, hk, latestFieldVersion);
        return res.status(200).json({
          ok: true,
          applied: applied,
          rejected: rejected,
          duplicates: duplicates,
          latestVersion: latestFieldVersion,
          minRetainedVersion: pruneResult.minRetainedVersion,
          prunedOps: pruneResult.deleted
        });
      }

      if (!body.data) return res.status(400).json({ error: 'Missing data' });

      var incomingIntegrity = inspectSnapshot(body.data);
      if (!incomingIntegrity.ok) {
        return res.status(400).json({ error: 'Invalid backup snapshot', integrity: incomingIntegrity });
      }

      var now = Date.now();
      var newDataHash = dataHash(body.data);

      // Get current metadata
      var metaRes = await redis(['GET', hk + ':meta']);
      var meta = metaRes.result ? JSON.parse(metaRes.result) : { versions: [] };

      // Check if data actually changed
      if (meta.lastDataHash === newDataHash) {
        var currentLatestVerify = await verifyStoredSnapshot(redis, hk, newDataHash);
        if (!currentLatestVerify.ok) {
          meta.lastDataHash = null;
        } else {
        // Data hasn't changed - update timestamp but skip full backup
          meta.lastTs = now;
          await redis(['SET', hk + ':meta', JSON.stringify(meta)]);
          var verifiedSkipMeta = await readJsonKey(redis, hk + ':meta', 8, 250);
          if (!verifiedSkipMeta || verifiedSkipMeta.lastTs !== now) {
            return res.status(500).json({ error: 'Backup metadata verification failed after unchanged write' });
          }
          return res.status(200).json({
            ok: true,
            ts: now,
            skipped: true,
            reason: 'Data unchanged',
            dataHash: newDataHash,
            versionCount: meta.versions.length,
            verified: true,
            integrity: currentLatestVerify.integrity || incomingIntegrity
          });
        }
      }

      // Data changed - perform full versioned backup
      var dataStr = JSON.stringify(body.data);

      // 1. Save versioned snapshot first
      await redis(['SET', hk + ':v:' + now, dataStr]);
      var versionVerify = await verifyStoredSnapshot(redis, hk + ':v:' + now, newDataHash);
      if (!versionVerify.ok) {
        return res.status(500).json({ error: versionVerify.reason || 'Version snapshot verification failed', integrity: versionVerify.integrity || null });
      }

      // 2. Save current backup to latest
      await redis(['SET', hk, dataStr]);
      var latestVerify = await verifyStoredSnapshot(redis, hk, newDataHash);
      if (!latestVerify.ok) {
        return res.status(500).json({ error: latestVerify.reason || 'Latest snapshot verification failed', integrity: latestVerify.integrity || null });
      }

      // 3. Update metadata with new version
      meta.versions.push({
        ts: now,
        dataHash: newDataHash,
        size: dataStr.length,
        keyCount: Object.keys(body.data).length,
        verified: true,
        legacy: !!incomingIntegrity.legacy
      });

      // 4. Trim old versions - keep only last MAX_VERSIONS
      if (meta.versions.length > MAX_VERSIONS) {
        var toRemove = meta.versions.splice(0, meta.versions.length - MAX_VERSIONS);
        // Delete old version snapshots from Redis
        for (var i = 0; i < toRemove.length; i++) {
          await redis(['DEL', hk + ':v:' + toRemove[i].ts]);
        }
      }

      meta.lastTs = now;
      meta.lastDataHash = newDataHash;

      // 5. Save updated metadata
      await redis(['SET', hk + ':meta', JSON.stringify(meta)]);
      var verifiedMeta = await readJsonKey(redis, hk + ':meta', 8, 250);
      if (!verifiedMeta || verifiedMeta.lastDataHash !== newDataHash || verifiedMeta.lastTs !== now) {
        return res.status(500).json({ error: 'Backup metadata verification failed' });
      }

      return res.status(200).json({
        ok: true,
        ts: now,
        dataHash: newDataHash,
        versionCount: meta.versions.length,
        verified: true,
        integrity: incomingIntegrity
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}

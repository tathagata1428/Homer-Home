import crypto from 'crypto';

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  Object.keys(value).sort().forEach((key) => {
    result[key] = sortObject(value[key]);
  });
  return result;
}

function hashValue(value) {
  return crypto.createHash('sha256').update(JSON.stringify(sortObject(value))).digest('hex');
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeProfile(profile) {
  return sortObject(asObject(profile));
}

function normalizeMemories(memories) {
  return asArray(memories)
    .map((item) => ({
      text: String((item && item.text) || '').trim(),
      category: String((item && item.category) || 'general').trim(),
      pinned: !!(item && item.pinned),
      ts: Number((item && item.ts) || 0),
      source: String((item && item.source) || '').trim(),
      confidence: typeof (item && item.confidence) === 'number' ? Number(item.confidence) : null
    }))
    .filter((item) => item.text)
    .sort((a, b) => (
      a.text.localeCompare(b.text) ||
      a.category.localeCompare(b.category) ||
      a.ts - b.ts
    ));
}

function normalizeHistory(history) {
  return asArray(history)
    .map((item) => ({
      role: item && item.role === 'assistant' ? 'assistant' : 'user',
      content: String((item && item.content) || '').trim()
    }))
    .filter((item) => item.content);
}

function normalizeFiles(files) {
  const result = {};
  Object.keys(asObject(files)).sort().forEach((name) => {
    let content = String(files[name] || '');
    content = content.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, '<timestamp>');
    result[name] = content;
  });
  return result;
}

function normalizeFileLibrary(fileLibrary) {
  return asArray(fileLibrary)
    .map((item) => sortObject(asObject(item)))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function normalizeCustomFiles(customFiles) {
  return sortObject(asObject(customFiles));
}

function normalizeJournal(journal) {
  return asArray(journal)
    .map((item) => ({
      type: String((item && item.type) || '').trim(),
      role: String((item && item.role) || '').trim(),
      text: String((item && item.text) || '').trim(),
      category: String((item && item.category) || '').trim(),
      ts: Number((item && item.ts) || 0),
      source: String((item && item.source) || '').trim()
    }))
    .filter((item) => item.type || item.text)
    .sort((a, b) => (
      a.ts - b.ts ||
      a.type.localeCompare(b.type) ||
      a.text.localeCompare(b.text)
    ));
}

export function computeJoeySyncMeta(bundle, extra = {}) {
  const profile = normalizeProfile(bundle && bundle.profile);
  const memories = normalizeMemories(bundle && bundle.memories);
  const history = normalizeHistory(bundle && bundle.history);
  const files = normalizeFiles(bundle && bundle.files);
  const fileLibrary = normalizeFileLibrary(bundle && bundle.fileLibrary);
  const customFiles = normalizeCustomFiles(bundle && bundle.customFiles);
  const journal = normalizeJournal(bundle && bundle.journal);

  const hashes = {
    profile: hashValue(profile),
    memories: hashValue(memories),
    history: hashValue(history),
    files: hashValue(files),
    fileLibrary: hashValue(fileLibrary),
    customFiles: hashValue(customFiles),
    journal: hashValue(journal),
    bundle: hashValue({ profile, memories, history, files, fileLibrary, customFiles, journal })
  };

  const counts = {
    memories: memories.length,
    history: history.length,
    files: Object.keys(files).length,
    fileLibrary: fileLibrary.length,
    customFiles: Object.keys(customFiles).length,
    journal: journal.length
  };

  return {
    mode: extra.mode || (bundle && bundle.mode) || 'personal',
    updatedAt: extra.updatedAt || new Date().toISOString(),
    lastCommittedAt: extra.lastCommittedAt || null,
    lastDriveBackupAt: extra.lastDriveBackupAt || null,
    lastDriveReconcileAt: extra.lastDriveReconcileAt || null,
    lastSource: extra.lastSource || 'unknown',
    driveExportedAt: extra.driveExportedAt || null,
    counts,
    hashes
  };
}

export function validateJoeySyncBundleMeta(bundle, candidateMeta) {
  const meta = asObject(candidateMeta);
  const hashes = asObject(meta.hashes);
  if (!Object.keys(hashes).length) {
    return { ok: false, reason: 'missing-hashes', expected: null, actual: computeJoeySyncMeta(bundle, meta) };
  }
  const actual = computeJoeySyncMeta(bundle, meta);
  const keys = ['profile', 'memories', 'history', 'files', 'fileLibrary', 'customFiles', 'journal', 'bundle'];
  const mismatches = keys.filter((key) => String(hashes[key] || '') !== String(actual.hashes[key] || ''));
  return {
    ok: mismatches.length === 0,
    reason: mismatches.length ? 'hash-mismatch' : 'ok',
    mismatches,
    expected: meta,
    actual
  };
}

export function buildJoeySyncDrift(redisMeta, driveMeta) {
  const redisHashes = asObject(redisMeta && redisMeta.hashes);
  const driveHashes = asObject(driveMeta && driveMeta.hashes);
  const bucketKeys = ['profile', 'memories', 'history', 'files', 'fileLibrary', 'customFiles', 'journal'];
  const buckets = bucketKeys.concat(['bundle']);
  const drift = {};
  let mismatchCount = 0;

  buckets.forEach((key) => {
    const redisHash = String(redisHashes[key] || '').trim();
    const driveHash = String(driveHashes[key] || '').trim();
    const available = !!(redisHash && driveHash);
    const match = available ? redisHash === driveHash : null;
    if (available && !match && bucketKeys.includes(key)) mismatchCount += 1;
    drift[key] = {
      available,
      match,
      redisHash,
      driveHash
    };
  });

  return {
    inSync: mismatchCount === 0 && bucketKeys.some((key) => drift[key].available),
    mismatchCount,
    buckets: drift
  };
}

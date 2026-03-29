import { getJoeyContextKeys, getJoeyMode } from '../lib/joey-context.js';
import handleGdriveFile from '../lib/gdrive-file-handler.js';
import { buildJoeySyncDrift, computeJoeySyncMeta } from '../lib/joey-sync-meta.js';
import {
  createRedisFetch,
  fetchWithRedirects,
  getGoogleDriveConfig,
  getRedisConfig,
  loadRedisJson,
  saveRedisJson,
  verifyJoeyPassphrase
} from '../lib/joey-server.js';

const MAX_HISTORY = 80;
const MAX_MEMORIES = 300;
const MAX_JOURNAL = 1000;
const SYSTEM_FILE_NAMES = new Set([
  'AgentContext.md',
  'Projects.md',
  'Areas.md',
  'Resources.md',
  'Archive.md',
  'Wins.md',
  'Lessons.md',
  'OpenLoops.md',
  'People.md',
  'Today.md',
  'WeeklyReview.md',
  'Decisions.md',
  'PinnedContext.md',
  'FilesIndex.md',
  'User.md',
  'Memory.md',
  'Tasks.md',
  'HistorySummary.md'
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isBlank(value) {
  if (value == null) return true;
  if (typeof value === 'string') return !value.trim();
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function dedupeMixedArray(items) {
  const result = [];
  const seen = new Set();
  asArray(items).forEach((item) => {
    const key = typeof item === 'string'
      ? 's:' + normalizeText(item)
      : 'j:' + JSON.stringify(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });
  return result;
}

function mergeProfile(currentValue, incomingValue) {
  const current = asObject(currentValue);
  const incoming = asObject(incomingValue);
  const merged = { ...current };

  Object.keys(incoming).forEach((key) => {
    const currentEntry = current[key];
    const incomingEntry = incoming[key];

    if (Array.isArray(currentEntry) || Array.isArray(incomingEntry)) {
      merged[key] = dedupeMixedArray([].concat(asArray(currentEntry), asArray(incomingEntry)));
      return;
    }

    if (
      currentEntry && incomingEntry &&
      typeof currentEntry === 'object' &&
      typeof incomingEntry === 'object' &&
      !Array.isArray(currentEntry) &&
      !Array.isArray(incomingEntry)
    ) {
      merged[key] = mergeProfile(currentEntry, incomingEntry);
      return;
    }

    merged[key] = isBlank(currentEntry) ? incomingEntry : currentEntry;
  });

  return merged;
}

function mergeMemories(currentValue, incomingValue) {
  const merged = new Map();

  function absorb(item) {
    if (!item || typeof item !== 'object') return;
    const text = String(item.text || '').trim();
    if (!text) return;
    const key = normalizeText(text);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...item,
        text,
        category: item.category || 'general',
        ts: item.ts || Date.now()
      });
      return;
    }
    merged.set(key, {
      ...existing,
      ...item,
      text: text.length > String(existing.text || '').length ? text : existing.text,
      category: existing.category && existing.category !== 'general' ? existing.category : (item.category || existing.category || 'general'),
      ts: Math.max(existing.ts || 0, item.ts || 0) || Date.now(),
      pinned: !!(existing.pinned || item.pinned),
      confidence: Math.max(
        typeof existing.confidence === 'number' ? existing.confidence : 0,
        typeof item.confidence === 'number' ? item.confidence : 0
      ) || undefined
    });
  }

  asArray(currentValue).forEach(absorb);
  asArray(incomingValue).forEach(absorb);

  return [...merged.values()]
    .sort((a, b) => (a.ts || 0) - (b.ts || 0))
    .slice(-MAX_MEMORIES);
}

function mergeHistory(currentValue, incomingValue) {
  const seen = new Set();
  const merged = [];

  function absorb(item) {
    if (!item || (item.role !== 'user' && item.role !== 'assistant')) return;
    const content = String(item.content || '').trim();
    if (!content) return;
    const key = item.role + '::' + normalizeText(content);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({
      role: item.role,
      content: content.slice(0, 2000)
    });
  }

  asArray(currentValue).forEach(absorb);
  asArray(incomingValue).forEach(absorb);

  return merged.slice(-MAX_HISTORY);
}

function mergeJournal(currentValue, incomingValue) {
  const merged = new Map();

  function absorb(item) {
    if (!item || typeof item !== 'object') return;
    const type = String(item.type || '').trim();
    const text = String(item.text || '').trim();
    if (!type && !text) return;
    const role = String(item.role || '').trim();
    const category = String(item.category || '').trim();
    const ts = Number(item.ts || 0) || Date.now();
    const key = [
      normalizeText(type),
      normalizeText(role),
      normalizeText(text),
      normalizeText(category),
      ts
    ].join('::');
    if (merged.has(key)) return;
    merged.set(key, {
      type,
      role,
      text: text.slice(0, 2000),
      category,
      source: String(item.source || '').trim(),
      ts
    });
  }

  asArray(currentValue).forEach(absorb);
  asArray(incomingValue).forEach(absorb);

  return [...merged.values()]
    .sort((a, b) => (a.ts || 0) - (b.ts || 0))
    .slice(-MAX_JOURNAL);
}

function mergeFileLibrary(currentValue, incomingValue) {
  const merged = new Map();

  function absorb(item) {
    if (!item || typeof item !== 'object') return;
    const key = String(item.id || item.driveUrl || item.webViewLink || item.name || '').trim();
    if (!key) return;
    const existing = merged.get(key);
    merged.set(key, existing ? { ...item, ...existing } : { ...item });
  }

  asArray(incomingValue).forEach(absorb);
  asArray(currentValue).forEach(absorb);

  return [...merged.values()];
}

function deriveCustomFiles(filesValue) {
  const files = asObject(filesValue);
  const derived = {};
  Object.entries(files).forEach(([name, content]) => {
    const safeName = String(name || '').trim();
    if (!safeName || SYSTEM_FILE_NAMES.has(safeName) || /^Uploads\//i.test(safeName)) return;
    if (typeof content !== 'string' || !content.trim()) return;
    derived[safeName] = content.trim();
  });
  return derived;
}

function mergeCustomFiles(currentValue, incomingValue, fallbackFiles) {
  const current = asObject(currentValue);
  const incoming = asObject(incomingValue);
  const derived = deriveCustomFiles(fallbackFiles);
  const merged = { ...incoming, ...derived, ...current };

  Object.keys(merged).forEach((name) => {
    if (typeof merged[name] !== 'string' || !merged[name].trim()) delete merged[name];
  });

  return merged;
}

function mergeFiles(currentValue, incomingValue, mergedCustomFiles) {
  const current = asObject(currentValue);
  const incoming = asObject(incomingValue);
  const merged = { ...incoming, ...current };

  Object.entries(incoming).forEach(([name, content]) => {
    if (isBlank(merged[name]) && typeof content === 'string' && content.trim()) {
      merged[name] = content;
    }
  });

  Object.entries(mergedCustomFiles || {}).forEach(([name, content]) => {
    if (!merged[name] || isBlank(merged[name])) merged[name] = content;
  });

  return merged;
}

function countAddedItems(currentItems, mergedItems, getKey) {
  const before = new Set(asArray(currentItems).map(getKey).filter(Boolean));
  let added = 0;
  asArray(mergedItems).forEach((item) => {
    const key = getKey(item);
    if (!key || before.has(key)) return;
    added += 1;
  });
  return added;
}

async function fetchDriveBundle(mode, gdriveWebhook, gdriveSecret) {
  const restoreUrl = gdriveWebhook + '?action=restore&secret=' + encodeURIComponent(gdriveSecret) + '&mode=' + encodeURIComponent(mode);
  const response = await fetchWithRedirects(restoreUrl, { method: 'GET' });
  const redirectChain = response.redirectChain || [];

  if (!response.text) {
    return { ok: false, error: response.error || 'No response after redirects', status: response.status || 502, redirectChain };
  }

  try {
    const parsed = JSON.parse(response.text);
    if (parsed && parsed.error) {
      return { ok: false, error: parsed.error, status: response.status || 502, redirectChain };
    }
    return { ok: true, data: parsed, status: response.status || 200, redirectChain };
  } catch (error) {
    const isHtml = response.text.trim().startsWith('<');
    return {
      ok: false,
      error: isHtml ? 'Google returned HTML instead of JSON' : 'Non-JSON response from Google',
      status: response.status || 502,
      redirectChain
    };
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.query && req.query.action === 'file') {
    return handleGdriveFile(req, res);
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { passphrase } = body;
  const compareOnly = !!body.compareOnly;
  if (!passphrase) return res.status(401).json({ error: 'Missing passphrase' });

  const mode = getJoeyMode(req);
  const { MEMORY_KEY, PROFILE_KEY, HISTORY_KEY, FILES_KEY, FILE_LIBRARY_KEY, CUSTOM_FILES_KEY, JOURNAL_KEY, SYNC_META_KEY } = getJoeyContextKeys(mode);
  const { webhook: gdriveWebhook, secret: gdriveSecret } = getGoogleDriveConfig();
  if (!gdriveWebhook) return res.status(500).json({ error: 'GDRIVE_WEBHOOK_URL not configured' });
  if (!gdriveSecret) return res.status(500).json({ error: 'GDRIVE_SECRET not configured' });

  const redisFetch = createRedisFetch();
  const { url: redisUrl, token: redisToken } = getRedisConfig();
  if (!redisUrl || !redisToken || !redisFetch) return res.status(500).json({ error: 'Redis not configured' });

  try {
    const isValid = await verifyJoeyPassphrase(passphrase, redisFetch);
    if (!isValid) return res.status(403).json({ error: 'Forbidden' });

    const drive = await fetchDriveBundle(mode, gdriveWebhook, gdriveSecret);
    if (!drive.ok) {
      return res.status(drive.status || 502).json({
        error: drive.error || 'Drive reconciliation failed',
        redirectChain: drive.redirectChain || []
      });
    }

    const driveData = asObject(drive.data);
    const [currentProfile, currentMemories, currentHistory, currentFiles, currentFileLibrary, currentCustomFiles, currentJournal, storedSyncMeta] = await Promise.all([
      loadRedisJson(redisFetch, PROFILE_KEY, {}),
      loadRedisJson(redisFetch, MEMORY_KEY, []),
      loadRedisJson(redisFetch, HISTORY_KEY, []),
      loadRedisJson(redisFetch, FILES_KEY, {}),
      loadRedisJson(redisFetch, FILE_LIBRARY_KEY, []),
      loadRedisJson(redisFetch, CUSTOM_FILES_KEY, {}),
      loadRedisJson(redisFetch, JOURNAL_KEY, []),
      loadRedisJson(redisFetch, SYNC_META_KEY, {})
    ]);

    const nowIso = new Date().toISOString();
    const redisBundle = {
      mode,
      profile: currentProfile,
      memories: currentMemories,
      history: currentHistory,
      files: currentFiles,
      fileLibrary: currentFileLibrary,
      customFiles: currentCustomFiles,
      journal: currentJournal
    };
    const redisMeta = computeJoeySyncMeta(redisBundle, {
      ...(storedSyncMeta && typeof storedSyncMeta === 'object' ? storedSyncMeta : {}),
      mode,
      updatedAt: nowIso,
      lastSource: 'redis'
    });
    const driveMeta = computeJoeySyncMeta({
      mode,
      profile: driveData.profile,
      memories: driveData.memories,
      history: driveData.history,
      files: driveData.files,
      fileLibrary: driveData.fileLibrary,
      customFiles: driveData.customFiles || deriveCustomFiles(driveData.files),
      journal: driveData.journal || []
    }, {
      ...(driveData.syncMeta && typeof driveData.syncMeta === 'object' ? driveData.syncMeta : {}),
      mode,
      updatedAt: nowIso,
      driveExportedAt: driveData.exportedAt || (driveData.syncMeta && driveData.syncMeta.driveExportedAt) || null,
      lastSource: 'google-drive'
    });

    const mergedProfile = mergeProfile(currentProfile, driveData.profile);
    const mergedMemories = mergeMemories(currentMemories, driveData.memories);
    const mergedHistory = mergeHistory(currentHistory, driveData.history);
    const mergedFileLibrary = mergeFileLibrary(currentFileLibrary, driveData.fileLibrary);
    const mergedCustomFiles = mergeCustomFiles(currentCustomFiles, driveData.customFiles, driveData.files);
    const mergedFiles = mergeFiles(currentFiles, driveData.files, mergedCustomFiles);
    const mergedJournal = mergeJournal(currentJournal, driveData.journal);

    const added = {
      memories: countAddedItems(currentMemories, mergedMemories, (item) => normalizeText(item && item.text)),
      history: countAddedItems(currentHistory, mergedHistory, (item) => (item && item.role ? item.role + '::' + normalizeText(item.content) : '')),
      fileLibrary: countAddedItems(currentFileLibrary, mergedFileLibrary, (item) => String((item && (item.id || item.driveUrl || item.name)) || '').trim()),
      customFiles: Math.max(0, Object.keys(mergedCustomFiles).length - Object.keys(asObject(currentCustomFiles)).length),
      files: Math.max(0, Object.keys(mergedFiles).length - Object.keys(asObject(currentFiles)).length),
      journal: countAddedItems(currentJournal, mergedJournal, (item) => {
        if (!item) return '';
        return [
          normalizeText(item.type),
          normalizeText(item.role),
          normalizeText(item.text),
          Number(item.ts || 0)
        ].join('::');
      })
    };

    const changed = !!(
      added.memories ||
      added.history ||
      added.fileLibrary ||
      added.customFiles ||
      added.files ||
      added.journal ||
      JSON.stringify(asObject(currentProfile)) !== JSON.stringify(mergedProfile)
    );

    const mergedMeta = computeJoeySyncMeta({
      mode,
      profile: mergedProfile,
      memories: mergedMemories,
      history: mergedHistory,
      files: mergedFiles,
      fileLibrary: mergedFileLibrary,
      customFiles: mergedCustomFiles,
      journal: mergedJournal
    }, {
      ...(storedSyncMeta && typeof storedSyncMeta === 'object' ? storedSyncMeta : {}),
      mode,
      updatedAt: nowIso,
      lastDriveReconcileAt: nowIso,
      driveExportedAt: driveMeta.driveExportedAt || null,
      lastSource: compareOnly ? 'gdrive-reconcile-preview' : 'gdrive-reconcile'
    });
    const driftBefore = buildJoeySyncDrift(redisMeta, driveMeta);
    const driftAfter = buildJoeySyncDrift(mergedMeta, driveMeta);

    if (!compareOnly) {
      await Promise.all([
        saveRedisJson(redisFetch, PROFILE_KEY, mergedProfile),
        saveRedisJson(redisFetch, MEMORY_KEY, mergedMemories),
        saveRedisJson(redisFetch, HISTORY_KEY, mergedHistory),
        saveRedisJson(redisFetch, FILE_LIBRARY_KEY, mergedFileLibrary),
        saveRedisJson(redisFetch, CUSTOM_FILES_KEY, mergedCustomFiles),
        saveRedisJson(redisFetch, FILES_KEY, mergedFiles),
        saveRedisJson(redisFetch, JOURNAL_KEY, mergedJournal),
        saveRedisJson(redisFetch, SYNC_META_KEY, mergedMeta)
      ]);
    }

    return res.status(200).json({
      ok: true,
      mode,
      compareOnly,
      changed,
      wouldChange: changed,
      comparedAt: Date.now(),
      driveTimestamp: driveData.exportedAt || null,
      syncMeta: compareOnly ? redisMeta : mergedMeta,
      driveMeta,
      drift: {
        before: driftBefore,
        after: driftAfter
      },
      reconciled: {
        profile: true,
        memories: { total: mergedMemories.length, added: added.memories },
        history: { total: mergedHistory.length, added: added.history },
        fileLibrary: { total: mergedFileLibrary.length, added: added.fileLibrary },
        customFiles: { total: Object.keys(mergedCustomFiles).length, added: added.customFiles },
        files: { total: Object.keys(mergedFiles).length, added: added.files },
        journal: { total: mergedJournal.length, added: added.journal }
      },
      message: compareOnly
        ? (changed
          ? 'Compared Drive with Redis. A safe merge would add missing Joey context into Redis without overwriting conflicts.'
          : (driftBefore.inSync
            ? 'Compared Drive with Redis. Redis already had the current Joey context.'
            : 'Compared Drive with Redis. Redis kept its current values where Drive differed.'))
        : (changed
          ? 'Compared Drive with Redis and merged missing Joey context into Redis.'
          : (driftBefore.inSync
            ? 'Compared Drive with Redis. Redis already had the current Joey context.'
            : 'Compared Drive with Redis. Redis kept its current values where Drive differed.'))
    });
  } catch (error) {
    console.error('[gdrive-reconcile] Exception:', error.message, error.stack);
    return res.status(500).json({ error: 'Reconciliation failed', detail: error.message });
  }
}

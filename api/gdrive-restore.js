// Google Drive context restore — fetches Joey context from Google Apps Script, restores to Redis/Supabase
import { compactFileLibraryEntries, mergeDerivedFileContext } from '../lib/context-files.js';
import { getJoeyContextKeys, getJoeyMode } from '../lib/joey-context.js';
import { computeJoeySyncMeta, validateJoeySyncBundleMeta } from '../lib/joey-sync-meta.js';
import {
  createRedisFetch,
  fetchWithRedirects,
  getGoogleDriveConfig,
  getRedisConfig,
  loadRedisJson,
  saveRedisJson,
  verifyJoeyPassphrase
} from '../lib/joey-server.js';
import {
  isSupabaseConfigured,
  createAdminClient,
  createUserClient,
  verifySupabaseJwt
} from '../lib/supabase-server.js';
import { createSupabaseRedisFetch } from '../lib/supabase-redis-compat.js';

function sanitizeCustomFilesMap(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const out = {};
  Object.entries(source).forEach(([name, content]) => {
    const safeName = String(name || '').trim();
    if (!safeName || /^Preserved\//i.test(safeName)) return;
    if (typeof content !== 'string' || !content.trim()) return;
    out[safeName] = content.trim();
  });
  return out;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // --- Auth ---
  const { passphrase } = req.body || {};
  const mode = getJoeyMode(req);
  const { MEMORY_KEY, PROFILE_KEY, HISTORY_KEY, FILES_KEY, FILE_LIBRARY_KEY, CUSTOM_FILES_KEY, JOURNAL_KEY, SYNC_META_KEY } = getJoeyContextKeys(mode);

  // --- Google Apps Script webhook ---
  const { webhook: gdriveWebhook, secret: gdriveSecret } = getGoogleDriveConfig();
  if (!gdriveWebhook) return res.status(500).json({ error: 'GDRIVE_WEBHOOK_URL not configured' });
  if (!gdriveSecret) return res.status(500).json({ error: 'GDRIVE_SECRET not configured' });

  // --- Resolve data backend (Supabase preferred for JWT users) ---
  let redisFetch;
  const authHeader = String(req.headers.authorization || '');
  const jwtToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  let supabaseUser = null;
  const supabaseEnabled = isSupabaseConfigured();
  const rawRedisFetch = createRedisFetch();
  const { url: redisUrl, token: redisToken } = getRedisConfig();
  if (jwtToken && supabaseEnabled) {
    supabaseUser = await verifySupabaseJwt(jwtToken).catch(() => null);
  }
  if (supabaseUser) {
    const supabaseClient = createUserClient(jwtToken);
    redisFetch = createSupabaseRedisFetch(supabaseClient, supabaseUser.id);
  } else {
    if (!passphrase) return res.status(401).json({ error: 'Missing passphrase' });
    // Try passphrase against admin hash first — works without Redis
    const adminHash = String(process.env.HOMER_ADMIN_HASH || '').trim();
    const ownerId = String(process.env.SUPABASE_OWNER_ID || '').trim();
    let isValid = !!adminHash && passphrase.trim() === adminHash;
    if (!isValid && rawRedisFetch) {
      isValid = await verifyJoeyPassphrase(passphrase, rawRedisFetch);
    }
    if (!isValid) return res.status(403).json({ error: 'Forbidden' });

    if (supabaseEnabled && ownerId) {
      redisFetch = createSupabaseRedisFetch(createAdminClient(), ownerId);
    } else {
      if (!redisUrl || !redisToken || !rawRedisFetch) return res.status(500).json({ error: 'Redis not configured' });
      redisFetch = rawRedisFetch;
    }
  }

  try {

    const restoreUrl = gdriveWebhook + '?action=restore&secret=' + encodeURIComponent(gdriveSecret) + '&mode=' + encodeURIComponent(mode);
    const response = await fetchWithRedirects(restoreUrl, { method: 'GET' });
    const redirectChain = response.redirectChain || [];

    if (!response.text) {
      console.error('[gdrive-restore] ' + (response.error || 'No response after redirects'), JSON.stringify(redirectChain));
      return res.status(response.status || 502).json({ error: response.error || 'No response after redirects', redirectChain });
    }

    let parsed;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      const isHtml = response.text.trim().startsWith('<');
      console.error('[gdrive-restore] Non-JSON response, status=' + response.status + ', isHtml=' + isHtml + ', preview=' + response.text.slice(0, 200));
      console.error('[gdrive-restore] Redirect chain:', JSON.stringify(redirectChain));
      return res.status(502).json({
        error: isHtml ? 'Google returned HTML — Apps Script may need redeployment' : 'Non-JSON response',
        status: response.status,
        responsePreview: response.text.slice(0, 300),
        redirectChain
      });
    }

    if (parsed.error) {
      console.error('[gdrive-restore] Script error:', parsed.error, JSON.stringify(redirectChain));
      return res.status(502).json({
        error: 'Google Script rejected the request',
        scriptError: parsed.error,
        hint: parsed.error === 'Unauthorized'
          ? 'GDRIVE_SECRET env var does not match the SECRET in your Google Apps Script.'
          : undefined,
        redirectChain
      });
    }

    const driveScope = String(parsed.driveScope || '').trim().toLowerCase();
    const validation = validateJoeySyncBundleMeta({
      mode,
      profile: parsed.profile,
      memories: parsed.memories,
      history: parsed.history,
      files: parsed.files,
      fileLibrary: parsed.fileLibrary,
      customFiles: parsed.customFiles,
      journal: parsed.journal
    }, parsed.syncMeta);
    if (parsed.syncMeta && driveScope !== 'md-only' && !validation.ok && validation.reason !== 'missing-hashes') {
      return res.status(409).json({
        error: 'Drive bundle failed integrity validation',
        validation
      });
    }

    // Restore to Redis
    const { profile, memories, history, files, fileLibrary, customFiles, journal, syncMeta } = parsed;
    const [currentProfile, currentMemories, currentHistory, currentFileLibrary, currentJournal] = await Promise.all([
      loadRedisJson(redisFetch, PROFILE_KEY, {}),
      loadRedisJson(redisFetch, MEMORY_KEY, []),
      loadRedisJson(redisFetch, HISTORY_KEY, []),
      loadRedisJson(redisFetch, FILE_LIBRARY_KEY, []),
      loadRedisJson(redisFetch, JOURNAL_KEY, [])
    ]);
    const restoredFileLibrary = compactFileLibraryEntries(fileLibrary || currentFileLibrary || []);
    const restoredCustomFiles = sanitizeCustomFilesMap(customFiles || {});
    const restoredFiles = driveScope === 'md-only'
      ? (files && typeof files === 'object' ? files : {})
      : mergeDerivedFileContext(files || {}, restoredFileLibrary, restoredCustomFiles, new Date().toISOString());
    const results = { profile: false, memories: false, history: false, files: false, fileLibrary: false, customFiles: false, journal: false, syncMeta: false };

    if (profile !== undefined) {
      await saveRedisJson(redisFetch, PROFILE_KEY, profile || {});
      results.profile = true;
    }
    if (memories !== undefined) {
      await saveRedisJson(redisFetch, MEMORY_KEY, memories || []);
      results.memories = true;
    }
    if (history !== undefined) {
      await saveRedisJson(redisFetch, HISTORY_KEY, history || []);
      results.history = true;
    }
    if (files !== undefined) {
      await saveRedisJson(redisFetch, FILES_KEY, restoredFiles);
      results.files = true;
    }
    if (fileLibrary !== undefined) {
      await saveRedisJson(redisFetch, FILE_LIBRARY_KEY, restoredFileLibrary);
      results.fileLibrary = true;
    }
    if (customFiles !== undefined) {
      await saveRedisJson(redisFetch, CUSTOM_FILES_KEY, restoredCustomFiles);
      results.customFiles = true;
    }
    if (journal !== undefined) {
      await saveRedisJson(redisFetch, JOURNAL_KEY, journal || []);
      results.journal = true;
    }
    const computedSyncMeta = computeJoeySyncMeta({
      mode,
      profile: profile !== undefined ? (profile || {}) : currentProfile,
      memories: memories !== undefined ? (memories || []) : currentMemories,
      history: history !== undefined ? (history || []) : currentHistory,
      files: restoredFiles,
      fileLibrary: restoredFileLibrary,
      customFiles: restoredCustomFiles,
      journal: journal !== undefined ? (journal || []) : currentJournal
    }, {
      ...(syncMeta && typeof syncMeta === 'object' ? syncMeta : {}),
      mode,
      updatedAt: new Date().toISOString(),
      lastDriveReconcileAt: new Date().toISOString(),
      driveExportedAt: parsed.exportedAt || (syncMeta && syncMeta.driveExportedAt) || null,
      lastSource: 'gdrive-restore'
    });
    await saveRedisJson(redisFetch, SYNC_META_KEY, computedSyncMeta);
    results.syncMeta = true;

    return res.status(200).json({
      ok: true,
      restored: results,
      timestamp: parsed.exportedAt || null,
      syncMeta: computedSyncMeta
    });

  } catch (err) {
    console.error('[gdrive-restore] Exception:', err.message, err.stack);
    return res.status(500).json({ error: 'Restore failed', detail: err.message });
  }
}

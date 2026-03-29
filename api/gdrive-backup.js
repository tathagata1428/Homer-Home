import { buildContextFiles } from '../lib/context-files.js';
import { getJoeyContextKeys, getJoeyMode } from '../lib/joey-context.js';
import { computeJoeySyncMeta } from '../lib/joey-sync-meta.js';
import {
  createRedisFetch,
  fetchWithRedirects,
  getGoogleDriveConfig,
  getRedisConfig,
  loadRedisJson,
  saveRedisJson,
  verifyJoeyPassphrase
} from '../lib/joey-server.js';

// Google Drive context backup — fetches Joey context from Redis, POSTs to Google Apps Script
export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // --- Auth ---
  const { passphrase } = req.body || {};
  if (!passphrase) return res.status(401).json({ error: 'Missing passphrase' });
  const mode = getJoeyMode(req);
  const { MEMORY_KEY, PROFILE_KEY, HISTORY_KEY, FILES_KEY, FILE_LIBRARY_KEY, CUSTOM_FILES_KEY, JOURNAL_KEY, SYNC_META_KEY } = getJoeyContextKeys(mode);

  // --- Google Apps Script webhook ---
  const { webhook: gdriveWebhook, secret: gdriveSecret } = getGoogleDriveConfig();
  if (!gdriveWebhook) return res.status(500).json({ error: 'GDRIVE_WEBHOOK_URL not configured' });
  if (!gdriveSecret) return res.status(500).json({ error: 'GDRIVE_SECRET not configured' });

  // --- Redis ---
  const redisFetch = createRedisFetch();
  const { url: redisUrl, token: redisToken } = getRedisConfig();
  if (!redisUrl || !redisToken || !redisFetch) return res.status(500).json({ error: 'Redis not configured' });

  try {
    const taskSnapshot = Array.isArray((req.body || {}).tasks) ? req.body.tasks : [];
    const effectiveTasks = mode === 'work' ? [] : taskSnapshot;
    const isValid = await verifyJoeyPassphrase(passphrase, redisFetch);
    if (!isValid) return res.status(403).json({ error: 'Forbidden' });

    const [memories, profile, fullHistory, filesResult, fileLibrary, customFiles, journal, syncMetaStored] = await Promise.all([
      loadRedisJson(redisFetch, MEMORY_KEY, []),
      loadRedisJson(redisFetch, PROFILE_KEY, null),
      loadRedisJson(redisFetch, HISTORY_KEY, []),
      loadRedisJson(redisFetch, FILES_KEY, {}),
      loadRedisJson(redisFetch, FILE_LIBRARY_KEY, []),
      loadRedisJson(redisFetch, CUSTOM_FILES_KEY, {}),
      loadRedisJson(redisFetch, JOURNAL_KEY, []),
      loadRedisJson(redisFetch, SYNC_META_KEY, {})
    ]);

    let history = Array.isArray(fullHistory) ? fullHistory : [];
    if (history.length > 30) history = history.slice(-30);

    let files = filesResult && typeof filesResult === 'object' ? filesResult : {};
    if (!files || !files['AgentContext.md'] || effectiveTasks.length) {
      files = buildContextFiles({
        profile: profile || {},
        memories,
        history,
        tasks: effectiveTasks,
        fileLibrary,
        customFiles,
        scope: mode
      });
    }
    await saveRedisJson(redisFetch, FILES_KEY, files);

    const syncMeta = computeJoeySyncMeta({
      mode,
      profile: profile || {},
      memories,
      history,
      files,
      fileLibrary,
      customFiles,
      journal
    }, {
      ...(syncMetaStored && typeof syncMetaStored === 'object' ? syncMetaStored : {}),
      mode,
      updatedAt: new Date().toISOString(),
      lastSource: 'gdrive-backup'
    });

    const payload = {
      secret: gdriveSecret,
      mode,
      profile,
      memories,
      history,
      files,
      fileLibrary,
      customFiles,
      journal,
      syncMeta
    };

    // --- POST to Google Apps Script with manual redirect following ---
    // Google Apps Script returns 302 redirects; we follow manually for reliability
    const response = await fetchWithRedirects(gdriveWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const redirectChain = response.redirectChain || [];

    if (!response.text) {
      console.error('[gdrive-backup] ' + (response.error || 'No response after redirects'), JSON.stringify(redirectChain));
      return res.status(response.status || 502).json({ error: response.error || 'No response after redirects', redirectChain });
    }

    // Parse response
    let parsed;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      // Got HTML or non-JSON response — likely Google auth/error page
      const isHtml = response.text.trim().startsWith('<');
      console.error('[gdrive-backup] Non-JSON response, status=' + response.status + ', isHtml=' + isHtml + ', preview=' + response.text.slice(0, 200));
      console.error('[gdrive-backup] Redirect chain:', JSON.stringify(redirectChain));
      return res.status(502).json({
        error: isHtml ? 'Google returned HTML instead of JSON — the Apps Script may need redeployment' : 'Non-JSON response from Google',
        status: response.status,
        responsePreview: response.text.slice(0, 300),
        redirectChain
      });
    }

    // Check for script-level errors
    if (parsed.error) {
      console.error('[gdrive-backup] Script error:', parsed.error, JSON.stringify(redirectChain));
      return res.status(502).json({
        error: 'Google Script rejected the request',
        scriptError: parsed.error,
        hint: parsed.error === 'Unauthorized'
          ? 'GDRIVE_SECRET env var does not match the SECRET in your Google Apps Script. Check both values match exactly.'
          : undefined,
        redirectChain
      });
    }

    const nextSyncMeta = {
      ...syncMeta,
      updatedAt: new Date().toISOString(),
      lastDriveBackupAt: new Date().toISOString(),
      driveExportedAt: parsed && parsed.exportedAt ? parsed.exportedAt : syncMeta.driveExportedAt || null,
      lastSource: 'gdrive-backup'
    };
    await saveRedisJson(redisFetch, SYNC_META_KEY, nextSyncMeta);

    return res.status(200).json({ ok: true, drive: parsed, syncMeta: nextSyncMeta });

  } catch (err) {
    console.error('[gdrive-backup] Exception:', err.message, err.stack);
    return res.status(500).json({ error: 'Backup failed', detail: err.message });
  }
}

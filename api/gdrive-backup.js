import { buildContextFiles, compactFileLibraryEntries, mergeDerivedFileContext, preserveGeneratedContextFiles } from '../lib/context-files.js';
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

const GDRIVE_BACKUP_TIMEOUT_MS = 60000;
const QUOTES_FILE_NAME = 'Quotes.md';

function filterMarkdownFileMap(value) {
  const source = value && typeof value === 'object' ? value : {};
  const filtered = {};
  Object.entries(source).forEach(([name, content]) => {
    const safeName = String(name || '').trim();
    if (!safeName || !/\.md$/i.test(safeName)) return;
    if (typeof content !== 'string' || !content.trim()) return;
    filtered[safeName] = content;
  });
  return filtered;
}

function normalizeQuoteKey(text, author) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ') + '|' + String(author || 'Unknown').trim().toLowerCase();
}

function extractQuoteEntriesFromMarkdown(markdown) {
  const value = String(markdown || '').replace(/\r\n/g, '\n').trim();
  if (!value) return [];
  const entries = [];
  const blocks = value.split(/\n(?=##\s+Quote\b)/g);
  blocks.forEach((block) => {
    const quoteMatch = block.match(/^\s*>\s*([\s\S]*?)(?:\n(?:-|##|$))/m);
    const authorMatch = block.match(/^\s*-\s*Author:\s*(.+)$/mi);
    const savedMatch = block.match(/^\s*-\s*Saved:\s*(.+)$/mi);
    const quoteText = quoteMatch ? quoteMatch[1].replace(/\n>\s*/g, '\n').trim() : '';
    const author = authorMatch ? String(authorMatch[1] || '').trim() : 'Unknown';
    const savedAt = savedMatch ? String(savedMatch[1] || '').trim() : '';
    if (!quoteText) return;
    entries.push({ quote: quoteText, author: author || 'Unknown', savedAt });
  });
  return entries;
}

function buildQuotesMarkdown(entries) {
  const items = Array.isArray(entries) ? entries.filter((entry) => entry && String(entry.quote || '').trim()) : [];
  if (!items.length) return '';
  const lines = [
    '# Quotes',
    '',
    'Saved quotes from Homer Motivator and Joey memory. Joey can use these for recall, tone, advice, and preference shaping.',
    ''
  ];
  items.forEach((entry, index) => {
    const quote = String(entry.quote || '').trim().replace(/^["“']+|["”']+$/g, '');
    const author = String(entry.author || 'Unknown').trim() || 'Unknown';
    const savedAt = String(entry.savedAt || '').trim();
    lines.push('## Quote ' + (index + 1));
    lines.push('> "' + quote.replace(/\r?\n+/g, '\n> ') + '"');
    lines.push('');
    lines.push('- Author: ' + author);
    if (savedAt) lines.push('- Saved: ' + savedAt);
    lines.push('');
  });
  return lines.join('\n').trim() + '\n';
}

function mergeQuotesMarkdown(existingMarkdown, incomingMarkdown) {
  const merged = [];
  const seen = new Set();
  const addEntries = (entries) => {
    entries.forEach((entry) => {
      const quote = String(entry && entry.quote || '').trim();
      if (!quote) return;
      const author = String(entry && entry.author || 'Unknown').trim() || 'Unknown';
      const savedAt = String(entry && entry.savedAt || '').trim();
      const key = normalizeQuoteKey(quote, author);
      if (seen.has(key)) return;
      seen.add(key);
      merged.push({ quote, author, savedAt });
    });
  };
  addEntries(extractQuoteEntriesFromMarkdown(existingMarkdown));
  addEntries(extractQuoteEntriesFromMarkdown(incomingMarkdown));
  return buildQuotesMarkdown(merged);
}

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
    const requestKind = String((req.body || {}).kind || '').trim().toLowerCase();
    const forceBackup = !!(req.body && req.body.force);
    const redisOnly = !!(req.body && req.body.redisOnly);
    const taskSnapshot = Array.isArray((req.body || {}).tasks) ? req.body.tasks : [];
    const quoteMarkdown = typeof (req.body || {}).quoteMarkdown === 'string' ? String(req.body.quoteMarkdown || '').trim() : '';
    const cleanupManaged = !!(req.body && req.body.cleanupManaged);
    const effectiveTasks = redisOnly ? [] : taskSnapshot;
    const isValid = await verifyJoeyPassphrase(passphrase, redisFetch);
    if (!isValid) return res.status(403).json({ error: 'Forbidden' });

    if (requestKind === 'vault-snapshot') {
      const snapshot = req.body && req.body.snapshot && typeof req.body.snapshot === 'object' ? req.body.snapshot : null;
      if (!snapshot) return res.status(400).json({ error: 'Missing vault snapshot' });

      const payload = {
        secret: gdriveSecret,
        kind: 'vault-snapshot',
        snapshot,
        manifest: req.body && req.body.manifest ? req.body.manifest : null,
        meta: req.body && req.body.meta && typeof req.body.meta === 'object' ? req.body.meta : {}
      };

      const response = await fetchWithRedirects(gdriveWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeoutMs: GDRIVE_BACKUP_TIMEOUT_MS,
        body: JSON.stringify(payload)
      });
      const redirectChain = response.redirectChain || [];

      if (!response.text) {
        console.error('[gdrive-backup:vault] ' + (response.error || 'No response after redirects'), JSON.stringify(redirectChain));
        return res.status(response.status || 502).json({ error: response.error || 'No response after redirects', redirectChain });
      }

      let parsed;
      try {
        parsed = JSON.parse(response.text);
      } catch {
        const isHtml = response.text.trim().startsWith('<');
        console.error('[gdrive-backup:vault] Non-JSON response, status=' + response.status + ', isHtml=' + isHtml + ', preview=' + response.text.slice(0, 200));
        console.error('[gdrive-backup:vault] Redirect chain:', JSON.stringify(redirectChain));
        return res.status(502).json({
          error: isHtml ? 'Google returned HTML instead of JSON — the Apps Script may need redeployment' : 'Non-JSON response from Google',
          status: response.status,
          responsePreview: response.text.slice(0, 300),
          redirectChain
        });
      }

      if (parsed.error) {
        console.error('[gdrive-backup:vault] Script error:', parsed.error, JSON.stringify(redirectChain));
        return res.status(502).json({
          error: 'Google Script rejected the request',
          scriptError: parsed.error,
          hint: parsed.error === 'Unauthorized'
            ? 'GDRIVE_SECRET env var does not match the SECRET in your Google Apps Script. Check both values match exactly.'
            : undefined,
          redirectChain
        });
      }

      return res.status(200).json({ ok: true, kind: 'vault-snapshot', drive: parsed });
    }

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

    const history = Array.isArray(fullHistory) ? fullHistory : [];

    let files = filesResult && typeof filesResult === 'object' ? filesResult : {};
    const compactFileLibrary = compactFileLibraryEntries(fileLibrary);
    if (JSON.stringify(compactFileLibrary) !== JSON.stringify(fileLibrary)) {
      await saveRedisJson(redisFetch, FILE_LIBRARY_KEY, compactFileLibrary);
    }
    let nextCustomFiles = customFiles && typeof customFiles === 'object' ? { ...customFiles } : {};
    if (!redisOnly) {
      if (quoteMarkdown) {
        nextCustomFiles[QUOTES_FILE_NAME] = mergeQuotesMarkdown(nextCustomFiles[QUOTES_FILE_NAME], quoteMarkdown);
      }
      const generatedAt = String((syncMetaStored && (syncMetaStored.lastCommittedAt || syncMetaStored.updatedAt)) || new Date().toISOString());
      const generatedFiles = buildContextFiles({
        profile: profile || {},
        memories,
        history,
        tasks: effectiveTasks,
        fileLibrary: compactFileLibrary,
        existingFiles: files,
        customFiles: nextCustomFiles,
        scope: mode,
        generatedAt
      });
      const preserved = preserveGeneratedContextFiles(files, generatedFiles, nextCustomFiles, generatedAt);
      nextCustomFiles = preserved.customFiles && typeof preserved.customFiles === 'object' ? preserved.customFiles : nextCustomFiles;
      files = mergeDerivedFileContext(preserved.files, compactFileLibrary, nextCustomFiles, generatedAt);
      await Promise.all([
        saveRedisJson(redisFetch, FILES_KEY, files),
        saveRedisJson(redisFetch, CUSTOM_FILES_KEY, nextCustomFiles)
      ]);
    }

    const syncMeta = computeJoeySyncMeta({
      mode,
      profile: profile || {},
      memories,
      history,
      files,
      fileLibrary: compactFileLibrary,
      customFiles: nextCustomFiles,
      journal
    }, {
      ...(syncMetaStored && typeof syncMetaStored === 'object' ? syncMetaStored : {}),
      mode,
      updatedAt: new Date().toISOString(),
      lastSource: redisOnly ? 'gdrive-backup-redis' : 'gdrive-backup'
    });

    if (
      !forceBackup &&
      syncMetaStored &&
      typeof syncMetaStored === 'object' &&
      syncMetaStored.lastDriveBackupAt &&
      syncMetaStored.hashes &&
      syncMeta.hashes &&
      syncMetaStored.hashes.bundle === syncMeta.hashes.bundle
    ) {
      const nextSyncMeta = {
        ...syncMeta,
        lastDriveBackupAt: syncMetaStored.lastDriveBackupAt,
        driveExportedAt: syncMetaStored.driveExportedAt || null,
        lastSource: 'gdrive-backup-skip'
      };
      await saveRedisJson(redisFetch, SYNC_META_KEY, nextSyncMeta);
      return res.status(200).json({
        ok: true,
        skipped: true,
        unchanged: true,
        reason: 'Context unchanged since last Drive backup',
        syncMeta: nextSyncMeta
      });
    }

    const driveFiles = filterMarkdownFileMap(files);
    const driveCustomFiles = filterMarkdownFileMap(nextCustomFiles);
    const payload = {
      secret: gdriveSecret,
      mode,
      driveScope: 'md-only',
      files: driveFiles,
      customFiles: driveCustomFiles,
      syncMeta,
      cleanupManaged
    };

    // --- POST to Google Apps Script with manual redirect following ---
    // Google Apps Script returns 302 redirects; we follow manually for reliability
    const response = await fetchWithRedirects(gdriveWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeoutMs: GDRIVE_BACKUP_TIMEOUT_MS,
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
        scriptStack: parsed.stack || undefined,
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

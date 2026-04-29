import { buildContextFiles, compactFileLibraryEntries, mergeDerivedFileContext, preserveGeneratedContextFiles } from '../../lib/context-files.js';
import { getJoeyContextKeys, getJoeyMode } from '../../lib/joey-context.js';
import { computeJoeySyncMeta } from '../../lib/joey-sync-meta.js';
import {
  createRedisFetch,
  fetchWithRedirects,
  getGoogleDriveConfig,
  getRedisConfig,
  loadRedisJson,
  saveRedisJson,
  verifyJoeyPassphrase
} from '../../lib/joey-server.js';
import {
  isSupabaseClientConfigured,
  isSupabaseConfigured,
  createAdminClient,
  createUserClient,
  resolveSupabaseOwnerId,
  verifySupabaseJwt
} from '../../lib/supabase-server.js';
import { createSupabaseRedisFetch } from '../../lib/supabase-redis-compat.js';

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
    const quote = String(entry.quote || '').trim().replace(/^[""']+|[""']+$/g, '');
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

export async function onRequest(context) {
  const { request, env } = context;
  if (env && typeof env === "object") Object.assign(process.env, env);

  const origin = request.headers.get('origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
  }

  let body;
  try { body = await request.json(); } catch (e) { body = {}; }

  const { passphrase } = body || {};
  const mode = getJoeyMode(request);
  const { MEMORY_KEY, PROFILE_KEY, HISTORY_KEY, FILES_KEY, FILE_LIBRARY_KEY, CUSTOM_FILES_KEY, JOURNAL_KEY, SYNC_META_KEY } = getJoeyContextKeys(mode);

  const { webhook: gdriveWebhook, secret: gdriveSecret } = getGoogleDriveConfig();
  if (!gdriveWebhook) return Response.json({ error: 'GDRIVE_WEBHOOK_URL not configured' }, { status: 500, headers: corsHeaders });
  if (!gdriveSecret) return Response.json({ error: 'GDRIVE_SECRET not configured' }, { status: 500, headers: corsHeaders });

  let redisFetch;
  const authHeader = String(request.headers.get('authorization') || '');
  const jwtToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  let supabaseUser = null;
  const supabaseJwtEnabled = isSupabaseClientConfigured();
  const supabaseAdminEnabled = isSupabaseConfigured();
  const rawRedisFetch = createRedisFetch();
  const { url: redisUrl, token: redisToken } = getRedisConfig();
  if (jwtToken && supabaseJwtEnabled) {
    supabaseUser = await verifySupabaseJwt(jwtToken).catch(() => null);
  }
  if (supabaseUser) {
    const supabaseClient = createUserClient(jwtToken);
    redisFetch = createSupabaseRedisFetch(supabaseClient, supabaseUser.id);
  } else {
    if (!passphrase) return Response.json({ error: 'Missing passphrase' }, { status: 401, headers: corsHeaders });
    const adminHash = String(env.HOMER_ADMIN_HASH || '').trim();
    const ownerId = await resolveSupabaseOwnerId();
    let isValid = !!adminHash && passphrase.trim() === adminHash;
    if (!isValid) {
      isValid = await verifyJoeyPassphrase(passphrase, rawRedisFetch);
    }
    if (!isValid) return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });

    if (supabaseAdminEnabled && ownerId) {
      redisFetch = createSupabaseRedisFetch(createAdminClient(), ownerId);
    } else {
      if (!redisUrl || !redisToken || !rawRedisFetch) {
        return Response.json({ error: 'Redis not configured' }, { status: 500, headers: corsHeaders });
      }
      redisFetch = rawRedisFetch;
    }
  }

  try {
    const requestKind = String((body || {}).kind || '').trim().toLowerCase();
    const forceBackup = !!(body && body.force);
    const redisOnly = !!(body && body.redisOnly);
    const taskSnapshot = Array.isArray((body || {}).tasks) ? body.tasks : [];
    const quoteMarkdown = typeof (body || {}).quoteMarkdown === 'string' ? String(body.quoteMarkdown || '').trim() : '';
    const cleanupManaged = !!(body && body.cleanupManaged);
    const effectiveTasks = redisOnly ? [] : taskSnapshot;

    if (requestKind === 'vault-snapshot') {
      const snapshot = body && body.snapshot && typeof body.snapshot === 'object' ? body.snapshot : null;
      if (!snapshot) return Response.json({ error: 'Missing vault snapshot' }, { status: 400, headers: corsHeaders });

      const payload = {
        secret: gdriveSecret,
        kind: 'vault-snapshot',
        snapshot,
        manifest: body && body.manifest ? body.manifest : null,
        meta: body && body.meta && typeof body.meta === 'object' ? body.meta : {}
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
        return Response.json({ error: response.error || 'No response after redirects', redirectChain }, { status: response.status || 502, headers: corsHeaders });
      }

      let parsed;
      try {
        parsed = JSON.parse(response.text);
      } catch {
        const isHtml = response.text.trim().startsWith('<');
        return Response.json({
          error: isHtml ? 'Google returned HTML instead of JSON — the Apps Script may need redeployment' : 'Non-JSON response from Google',
          status: response.status,
          responsePreview: response.text.slice(0, 300),
          redirectChain
        }, { status: 502, headers: corsHeaders });
      }

      if (parsed.error) {
        return Response.json({
          error: 'Google Script rejected the request',
          scriptError: parsed.error,
          hint: parsed.error === 'Unauthorized'
            ? 'GDRIVE_SECRET env var does not match the SECRET in your Google Apps Script. Check both values match exactly.'
            : undefined,
          redirectChain
        }, { status: 502, headers: corsHeaders });
      }

      return Response.json({ ok: true, kind: 'vault-snapshot', drive: parsed }, { status: 200, headers: corsHeaders });
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
        lastDriveBackupAt: new Date().toISOString(),
        driveExportedAt: syncMetaStored.driveExportedAt || null,
        lastSource: 'gdrive-backup-skip'
      };
      await saveRedisJson(redisFetch, SYNC_META_KEY, nextSyncMeta);
      return Response.json({
        ok: true,
        skipped: true,
        unchanged: true,
        reason: 'Context unchanged since last Drive backup',
        syncMeta: nextSyncMeta
      }, { status: 200, headers: corsHeaders });
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

    const response = await fetchWithRedirects(gdriveWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeoutMs: GDRIVE_BACKUP_TIMEOUT_MS,
      body: JSON.stringify(payload)
    });
    const redirectChain = response.redirectChain || [];

    if (!response.text) {
      console.error('[gdrive-backup] ' + (response.error || 'No response after redirects'), JSON.stringify(redirectChain));
      return Response.json({ error: response.error || 'No response after redirects', redirectChain }, { status: response.status || 502, headers: corsHeaders });
    }

    let parsed;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      const isHtml = response.text.trim().startsWith('<');
      return Response.json({
        error: isHtml ? 'Google returned HTML instead of JSON — the Apps Script may need redeployment' : 'Non-JSON response from Google',
        status: response.status,
        responsePreview: response.text.slice(0, 300),
        redirectChain
      }, { status: 502, headers: corsHeaders });
    }

    if (parsed.error) {
      return Response.json({
        error: 'Google Script rejected the request',
        scriptError: parsed.error,
        scriptStack: parsed.stack || undefined,
        hint: parsed.error === 'Unauthorized'
          ? 'GDRIVE_SECRET env var does not match the SECRET in your Google Apps Script. Check both values match exactly.'
          : undefined,
        redirectChain
      }, { status: 502, headers: corsHeaders });
    }

    const nextSyncMeta = {
      ...syncMeta,
      updatedAt: new Date().toISOString(),
      lastDriveBackupAt: new Date().toISOString(),
      driveExportedAt: parsed && parsed.exportedAt ? parsed.exportedAt : syncMeta.driveExportedAt || null,
      lastSource: 'gdrive-backup'
    };
    await saveRedisJson(redisFetch, SYNC_META_KEY, nextSyncMeta);

    return Response.json({ ok: true, drive: parsed, syncMeta: nextSyncMeta }, { status: 200, headers: corsHeaders });

  } catch (err) {
    console.error('[gdrive-backup] Exception:', err.message, err.stack);
    return Response.json({ error: 'Backup failed', detail: err.message }, { status: 500, headers: corsHeaders });
  }
}

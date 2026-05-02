// Google Drive context restore — Cloudflare Pages Function version
import { compactFileLibraryEntries, mergeDerivedFileContext } from '../../lib/context-files.js';
import { getJoeyContextKeys, getJoeyMode } from '../../lib/joey-context.js';
import { computeJoeySyncMeta, validateJoeySyncBundleMeta } from '../../lib/joey-sync-meta.js';
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

  // Top-level safety net: any unhandled throw returns JSON instead of CF HTML 502
  try { return await _onRequest(context, corsHeaders); }
  catch (e) { return Response.json({ error: 'Unhandled server error', detail: String(e && e.message || e) }, { status: 500, headers: corsHeaders }); }
}

async function _onRequest(context, corsHeaders) {
  const { request, env } = context;
  console.log('[gdrive-restore] _onRequest started', request.method, request.url);

  let body;
  try { body = await request.json(); } catch (e) { body = {}; }

  const { passphrase } = body || {};
  // getJoeyMode reads req.body — for CF Pages the body stream is already consumed,
  // so pass a synthetic req with the pre-parsed body to get the correct mode.
  const mode = getJoeyMode({ method: request.method, body: body || {} });
  const { MEMORY_KEY, PROFILE_KEY, HISTORY_KEY, FILES_KEY, FILE_LIBRARY_KEY, CUSTOM_FILES_KEY, JOURNAL_KEY, SYNC_META_KEY } = getJoeyContextKeys(mode);

  const { webhook: gdriveWebhook, secret: gdriveSecret } = getGoogleDriveConfig(env);
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

    // Diagnostic: auth-test returns immediately after auth with no external calls.
    if (requestKind === 'auth-test') {
      return Response.json({ ok: true, authed: true, mode, ts: Date.now() }, { status: 200, headers: corsHeaders });
    }

    // Phase 1: fetch from Drive and stream the response back to the client.
    // Using a streaming response bypasses CF's 30-second wall-clock kill — CF keeps
    // the connection open as long as the stream is active, even if Apps Script is slow.
    if (requestKind === 'drive-fetch') {
      if (body && body.dryRun) {
        return Response.json({ ok: true, dryRun: true, mode, ts: Date.now() }, { status: 200, headers: corsHeaders });
      }
      const restoreUrl = gdriveWebhook + '?action=restore&secret=' + encodeURIComponent(gdriveSecret) + '&mode=' + encodeURIComponent(mode);

      let driveResponse;
      try {
        // Use redirect:'follow' so CF handles the redirect chain internally.
        driveResponse = await fetch(restoreUrl, { method: 'GET', redirect: 'follow' });
      } catch (fetchErr) {
        return Response.json({ error: 'Failed to connect to Google Drive', detail: String(fetchErr && fetchErr.message || fetchErr) }, { status: 502, headers: corsHeaders });
      }

      // Detect early errors via content-type before streaming.
      const contentType = String(driveResponse.headers.get('content-type') || '');
      if (!driveResponse.ok || contentType.includes('text/html')) {
        const errBody = await driveResponse.text().catch(() => '(no body)');
        return Response.json({ error: driveResponse.ok ? 'Drive returned HTML (Apps Script may need redeployment)' : 'Drive request failed', status: driveResponse.status, preview: errBody.slice(0, 300) }, { status: 502, headers: corsHeaders });
      }

      // Stream the Apps Script body wrapped in our standard envelope.
      // CF keeps the Worker alive until the readable side is fully consumed.
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const enc = new TextEncoder();
      (async () => {
        try {
          await writer.write(enc.encode('{"ok":true,"driveData":'));
          const reader = driveResponse.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(value);
          }
          await writer.write(enc.encode('}'));
          await writer.close();
        } catch (streamErr) {
          console.error('[gdrive-restore] stream error:', String(streamErr && streamErr.message || streamErr));
          writer.abort(streamErr).catch(() => {});
        }
      })();

      return new Response(readable, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Phase 2: apply pre-fetched Drive data to DB — no Drive fetch, just DB reads+writes.
    if (requestKind === 'drive-apply') {
      const parsed = body && body.driveData && typeof body.driveData === 'object' ? body.driveData : null;
      if (!parsed) return Response.json({ error: 'Missing driveData in body' }, { status: 400, headers: corsHeaders });
      const driveScope = String(parsed.driveScope || '').trim().toLowerCase();
      const validation = validateJoeySyncBundleMeta({ mode, profile: parsed.profile, memories: parsed.memories, history: parsed.history, files: parsed.files, fileLibrary: parsed.fileLibrary, customFiles: parsed.customFiles, journal: parsed.journal }, parsed.syncMeta);
      if (parsed.syncMeta && driveScope !== 'md-only' && !validation.ok && validation.reason !== 'missing-hashes') {
        return Response.json({ error: 'Drive bundle failed integrity validation', validation }, { status: 409, headers: corsHeaders });
      }
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
      const writeOps = [];
      if (profile !== undefined) writeOps.push(saveRedisJson(redisFetch, PROFILE_KEY, profile || {}).then(() => { results.profile = true; }));
      if (memories !== undefined) writeOps.push(saveRedisJson(redisFetch, MEMORY_KEY, memories || []).then(() => { results.memories = true; }));
      if (history !== undefined) writeOps.push(saveRedisJson(redisFetch, HISTORY_KEY, history || []).then(() => { results.history = true; }));
      if (files !== undefined) writeOps.push(saveRedisJson(redisFetch, FILES_KEY, restoredFiles).then(() => { results.files = true; }));
      if (fileLibrary !== undefined) writeOps.push(saveRedisJson(redisFetch, FILE_LIBRARY_KEY, restoredFileLibrary).then(() => { results.fileLibrary = true; }));
      if (customFiles !== undefined) writeOps.push(saveRedisJson(redisFetch, CUSTOM_FILES_KEY, restoredCustomFiles).then(() => { results.customFiles = true; }));
      if (journal !== undefined) writeOps.push(saveRedisJson(redisFetch, JOURNAL_KEY, journal || []).then(() => { results.journal = true; }));
      const computedSyncMeta = computeJoeySyncMeta({ mode, profile: profile !== undefined ? (profile || {}) : currentProfile, memories: memories !== undefined ? (memories || []) : currentMemories, history: history !== undefined ? (history || []) : currentHistory, files: restoredFiles, fileLibrary: restoredFileLibrary, customFiles: restoredCustomFiles, journal: journal !== undefined ? (journal || []) : currentJournal }, { ...(syncMeta && typeof syncMeta === 'object' ? syncMeta : {}), mode, updatedAt: new Date().toISOString(), lastDriveReconcileAt: new Date().toISOString(), driveExportedAt: parsed.exportedAt || (syncMeta && syncMeta.driveExportedAt) || null, lastSource: 'gdrive-restore' });
      writeOps.push(saveRedisJson(redisFetch, SYNC_META_KEY, computedSyncMeta).then(() => { results.syncMeta = true; }));
      await Promise.all(writeOps);
      return Response.json({ ok: true, restored: results, timestamp: parsed.exportedAt || null, syncMeta: computedSyncMeta }, { status: 200, headers: corsHeaders });
    }

    if (requestKind === 'vault-snapshot') {
      const vaultUrl = gdriveWebhook + '?action=restore-vault&secret=' + encodeURIComponent(gdriveSecret);
      const vaultResponse = await fetchWithRedirects(vaultUrl, { method: 'GET', timeoutMs: 22000 });
      if (!vaultResponse.text) {
        return Response.json({ error: vaultResponse.error || 'No response from Drive' }, { status: vaultResponse.status || 502, headers: corsHeaders });
      }
      let vaultParsed;
      try { vaultParsed = JSON.parse(vaultResponse.text); } catch {
        return Response.json({ error: 'Non-JSON response from Drive vault restore' }, { status: 502, headers: corsHeaders });
      }
      if (vaultParsed.error) return Response.json({ error: vaultParsed.error }, { status: 502, headers: corsHeaders });
      return Response.json({
        ok: true,
        kind: 'vault-snapshot',
        snapshot: vaultParsed.snapshot || {},
        exportedAt: vaultParsed.exportedAt || null
      }, { status: 200, headers: corsHeaders });
    }

    // Run Google fetch and Supabase reads in parallel to minimise total wall-clock time.
    const restoreUrl = gdriveWebhook + '?action=restore&secret=' + encodeURIComponent(gdriveSecret) + '&mode=' + encodeURIComponent(mode);
    const [response, [currentProfile, currentMemories, currentHistory, currentFileLibrary, currentJournal]] = await Promise.all([
      fetchWithRedirects(restoreUrl, { method: 'GET', timeoutMs: 22000 }),
      Promise.all([
        loadRedisJson(redisFetch, PROFILE_KEY, {}),
        loadRedisJson(redisFetch, MEMORY_KEY, []),
        loadRedisJson(redisFetch, HISTORY_KEY, []),
        loadRedisJson(redisFetch, FILE_LIBRARY_KEY, []),
        loadRedisJson(redisFetch, JOURNAL_KEY, [])
      ])
    ]);
    const redirectChain = response.redirectChain || [];

    if (!response.text) {
      console.error('[gdrive-restore] ' + (response.error || 'No response after redirects'), JSON.stringify(redirectChain));
      return Response.json({ error: response.error || 'No response after redirects', redirectChain }, { status: response.status || 502, headers: corsHeaders });
    }

    let parsed;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      const isHtml = response.text.trim().startsWith('<');
      return Response.json({
        error: isHtml ? 'Google returned HTML — Apps Script may need redeployment' : 'Non-JSON response',
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
          ? 'GDRIVE_SECRET env var does not match the SECRET in your Google Apps Script.'
          : undefined,
        redirectChain
      }, { status: 502, headers: corsHeaders });
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
      return Response.json({ error: 'Drive bundle failed integrity validation', validation }, { status: 409, headers: corsHeaders });
    }

    const { profile, memories, history, files, fileLibrary, customFiles, journal, syncMeta } = parsed;
    const restoredFileLibrary = compactFileLibraryEntries(fileLibrary || currentFileLibrary || []);
    const restoredCustomFiles = sanitizeCustomFilesMap(customFiles || {});
    const restoredFiles = driveScope === 'md-only'
      ? (files && typeof files === 'object' ? files : {})
      : mergeDerivedFileContext(files || {}, restoredFileLibrary, restoredCustomFiles, new Date().toISOString());
    const results = { profile: false, memories: false, history: false, files: false, fileLibrary: false, customFiles: false, journal: false, syncMeta: false };

    // Fire all writes in parallel to minimise wall-clock time.
    const writeOps = [];
    if (profile !== undefined) writeOps.push(saveRedisJson(redisFetch, PROFILE_KEY, profile || {}).then(() => { results.profile = true; }));
    if (memories !== undefined) writeOps.push(saveRedisJson(redisFetch, MEMORY_KEY, memories || []).then(() => { results.memories = true; }));
    if (history !== undefined) writeOps.push(saveRedisJson(redisFetch, HISTORY_KEY, history || []).then(() => { results.history = true; }));
    if (files !== undefined) writeOps.push(saveRedisJson(redisFetch, FILES_KEY, restoredFiles).then(() => { results.files = true; }));
    if (fileLibrary !== undefined) writeOps.push(saveRedisJson(redisFetch, FILE_LIBRARY_KEY, restoredFileLibrary).then(() => { results.fileLibrary = true; }));
    if (customFiles !== undefined) writeOps.push(saveRedisJson(redisFetch, CUSTOM_FILES_KEY, restoredCustomFiles).then(() => { results.customFiles = true; }));
    if (journal !== undefined) writeOps.push(saveRedisJson(redisFetch, JOURNAL_KEY, journal || []).then(() => { results.journal = true; }));

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
    writeOps.push(saveRedisJson(redisFetch, SYNC_META_KEY, computedSyncMeta).then(() => { results.syncMeta = true; }));

    await Promise.all(writeOps);

    return Response.json({
      ok: true,
      restored: results,
      timestamp: parsed.exportedAt || null,
      syncMeta: computedSyncMeta
    }, { status: 200, headers: corsHeaders });

  } catch (err) {
    console.error('[gdrive-restore] Exception:', err.message, err.stack);
    return Response.json({ error: 'Restore failed', detail: err.message }, { status: 500, headers: corsHeaders });
  }
}

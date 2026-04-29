/**
 * Joey API — Cloudflare Pages Function version.
 *
 * This handler delegates to the original api/joey.js logic but adapted for
 * the CF Pages onRequest(context) signature. The heavy lifting is done via
 * the cf-vercel-adapter for sub-handlers that use the Vercel req/res pattern.
 */
import { buildContextFiles, mergeDerivedFileContext, preserveGeneratedContextFiles } from '../../lib/context-files.js';
import handleJoeyCommit, { runLearnStep } from '../../lib/joey-commit-handler.js';
import { getJoeyContextKeys, getJoeyMode } from '../../lib/joey-context.js';
import { loadRedisJson, saveRedisJson, safeJsonParse, verifyJoeyPassphrase } from '../../lib/joey-server.js';
import { computeJoeySyncMeta } from '../../lib/joey-sync-meta.js';
import { createSupabaseRedisFetch } from '../../lib/supabase-redis-compat.js';
import {
  isSupabaseClientConfigured,
  createAdminClient,
  createUserClient,
  resolveSupabaseOwnerId,
  verifySupabaseJwt,
  isSupabaseConfigured
} from '../../lib/supabase-server.js';
import { createVercelAdapter } from '../../lib/cf-vercel-adapter.js';

export async function onRequest(context) {
  const { request, env } = context;
  // Make CF env vars available via process.env for libs that read process.env directly
  if (env && typeof env === 'object') {
    Object.assign(process.env, env);
  }

  const origin = request.headers.get('origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const { searchParams } = new URL(request.url);

  // Delegate commit action to the lib handler via adapter
  if (searchParams.get('action') === 'commit') {
    const { req, res, getResponse } = await createVercelAdapter(request);
    await handleJoeyCommit(req, res);
    return getResponse();
  }

  // Auth — accept Supabase JWT (new) OR legacy passphrase (backward compat)
  let body = null;
  if (request.method === 'POST' || request.method === 'DELETE') {
    try { body = await request.json(); } catch (e) { body = {}; }
  }

  const getPass = () => {
    if (request.method === 'GET') return searchParams.get('passphrase');
    if (body && typeof body === 'object') return body.passphrase;
    return null;
  };
  const passphrase = getPass();
  const authHeader = String(request.headers.get('authorization') || '');
  const jwtToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!passphrase && !jwtToken) {
    return Response.json({ error: 'Missing credentials' }, { status: 401, headers: corsHeaders });
  }

  const REDIS_URL   = env.KV_REST_API_URL   || env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = env.KV_REST_API_TOKEN  || env.UPSTASH_REDIS_REST_TOKEN;
  const redisRaw    = (REDIS_URL && REDIS_TOKEN)
    ? (cmd) => fetch(REDIS_URL, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + REDIS_TOKEN },
        body: JSON.stringify(cmd)
      }).then(r => r.json())
    : null;

  const supabaseJwtConfigured = isSupabaseClientConfigured();
  const supabaseAdminConfigured = isSupabaseConfigured();
  let supabaseClient = null;

  if (!redisRaw && !supabaseJwtConfigured && !supabaseAdminConfigured) {
    return Response.json({ error: 'No data store configured. Set Redis or Supabase env vars.' }, { status: 500, headers: corsHeaders });
  }

  let isValid = false;
  let userId = null;

  if (jwtToken && supabaseJwtConfigured) {
    const jwtUser = await verifySupabaseJwt(jwtToken);
    if (jwtUser) {
      isValid = true;
      userId = jwtUser.id;
      supabaseClient = createUserClient(jwtToken);
    }
  }

  if (!isValid && passphrase) {
    isValid = await verifyJoeyPassphrase(passphrase, redisRaw);
    if (isValid) {
      userId = await resolveSupabaseOwnerId() || null;
      if (supabaseAdminConfigured && userId) {
        supabaseClient = createAdminClient();
      }
    }
  }

  if (!isValid) return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });

  const redis = (supabaseClient && userId)
    ? createSupabaseRedisFetch(supabaseClient, userId)
    : redisRaw;

  if (!redis) return Response.json({ error: 'Data store unavailable' }, { status: 500, headers: corsHeaders });

  const mode = getJoeyMode(request);
  const { MEMORY_KEY, HISTORY_KEY, PROFILE_KEY, FILES_KEY, FILE_LIBRARY_KEY, CUSTOM_FILES_KEY, JOURNAL_KEY, SYNC_META_KEY } = getJoeyContextKeys(mode);
  const MAX_MEMORIES = 320;
  const MAX_HISTORY = 100;
  const MAX_JOURNAL = 1800;
  const requestDeviceId = String((body && body.deviceId) || '').trim().slice(0, 120);
  const requestDeviceLabel = String((body && body.deviceLabel) || '').trim().slice(0, 160);
  const REDIS_PLAN_BYTES = Math.max(1, Number(env.HOMER_REDIS_PLAN_BYTES || 1073741824) || 1073741824);

  async function loadJournal() { return loadRedisJson(redis, JOURNAL_KEY, []); }
  async function saveJournal(entries) {
    const trimmed = Array.isArray(entries) ? entries.slice(-MAX_JOURNAL) : [];
    await saveRedisJson(redis, JOURNAL_KEY, trimmed);
    return trimmed;
  }
  async function appendJournalEntries(entries) {
    const nextEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
    if (!nextEntries.length) return loadJournal();
    const current = await loadJournal();
    return saveJournal(current.concat(nextEntries));
  }
  function buildJournalEntry(type, data) {
    const payload = data && typeof data === 'object' ? data : {};
    return { type, role: payload.role || '', text: String(payload.text || '').slice(0, 2000), category: payload.category || '', source: payload.source || 'system', ts: Number(payload.ts || Date.now()) || Date.now() };
  }
  function measureJsonBytes(value) {
    try { return Buffer.byteLength(JSON.stringify(value == null ? null : value), 'utf8'); } catch (_error) { return 0; }
  }
  function buildSyncMetaDevicePatch(existing, updatedAt, source) {
    return { ...existing, mode, updatedAt, lastSource: source || existing.lastSource || 'joey-update', lastDeviceId: requestDeviceId || existing.lastDeviceId || '', lastDeviceLabel: requestDeviceLabel || existing.lastDeviceLabel || '', lastDeviceSyncedAt: updatedAt };
  }

  // ---- Inline helpers copied from api/joey.js ----

  function asObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  function asArray(value) { return Array.isArray(value) ? value : []; }
  function uniqueStringList(items) {
    const out = []; const seen = new Set();
    asArray(items).forEach((item) => { const value = String(item || '').trim(); if (!value) return; const key = value.toLowerCase(); if (seen.has(key)) return; seen.add(key); out.push(value); });
    return out;
  }
  function appendProfilePreference(profile, value) {
    const next = { ...asObject(profile) };
    const preference = String(value || '').trim();
    if (!preference) return next;
    next.preferences = uniqueStringList([].concat(asArray(next.preferences), [preference]));
    return next;
  }
  function applyDeterministicProfileMemory(profile, memoryText, category) {
    const current = { ...asObject(profile) };
    const raw = String(memoryText || '').replace(/\s+/g, ' ').trim();
    const normalized = raw.replace(/[.?!]+$/g, '').trim();
    const lowerCategory = String(category || '').trim().toLowerCase();
    if (!normalized) return current;
    let match = normalized.match(/^my\s+favou?rite\s+([a-z][a-z0-9 _-]{1,30})\s+is\s+(.+)$/i);
    if (match) {
      const subject = String(match[1] || '').trim().toLowerCase();
      const value = String(match[2] || '').trim();
      const normalizedSubject = subject === 'coleor' ? 'color' : subject;
      if (normalizedSubject === 'color' || normalizedSubject === 'colour') current.favorite_color = value;
      return appendProfilePreference(current, 'Favorite ' + normalizedSubject + ': ' + value);
    }
    match = normalized.match(/^i\s+prefer\s+(.+)$/i);
    if (match) {
      const value = String(match[1] || '').trim();
      if (/\bcelsius\b/i.test(value)) current.temperature_unit = 'celsius';
      if (/\bfahrenheit\b/i.test(value)) current.temperature_unit = 'fahrenheit';
      return appendProfilePreference(current, 'Prefers ' + value);
    }
    match = normalized.match(/^i\s+(always|usually|never)\s+(.+)$/i);
    if (match) return appendProfilePreference(current, String(match[1] || '').trim().toLowerCase() + ' ' + String(match[2] || '').trim());
    match = normalized.match(/^my\s+name\s+is\s+(.+)$/i);
    if (match && !String(current.name || '').trim()) { current.name = String(match[1] || '').trim(); return current; }
    if (lowerCategory === 'preference' || /\bprefer|preference|favorite|favourite|like|love\b/i.test(normalized)) return appendProfilePreference(current, normalized);
    return current;
  }
  function normalizeHistoryMessage(item, index) {
    if (!item || (item.role !== 'user' && item.role !== 'assistant')) return null;
    const content = String(item.content || '').slice(0, 2000);
    if (!content.trim()) return null;
    const rawTs = Number(item.ts);
    return { role: item.role, content, ts: Number.isFinite(rawTs) && rawTs > 0 ? rawTs : (Date.now() + index) };
  }
  function sameHistoryMessage(a, b) {
    return !!a && !!b && a.role === b.role && String(a.content || '') === String(b.content || '') && Number(a.ts || 0) === Number(b.ts || 0);
  }
  function historyIsPrefix(prefix, whole) {
    const left = Array.isArray(prefix) ? prefix : [];
    const right = Array.isArray(whole) ? whole : [];
    if (left.length > right.length) return false;
    for (let index = 0; index < left.length; index += 1) { if (!sameHistoryMessage(left[index], right[index])) return false; }
    return true;
  }
  function historyPrefixLength(a, b) {
    const left = Array.isArray(a) ? a : []; const right = Array.isArray(b) ? b : [];
    const max = Math.min(left.length, right.length); let index = 0;
    while (index < max && sameHistoryMessage(left[index], right[index])) index += 1;
    return index;
  }
  function historyTailHeadOverlap(a, b) {
    const left = Array.isArray(a) ? a : []; const right = Array.isArray(b) ? b : [];
    const max = Math.min(left.length, right.length);
    for (let size = max; size > 0; size -= 1) {
      let ok = true;
      for (let index = 0; index < size; index += 1) { if (!sameHistoryMessage(left[left.length - size + index], right[index])) { ok = false; break; } }
      if (ok) return size;
    }
    return 0;
  }
  function mergeHistoryMessages(existing, incoming, options = {}) {
    const current = (Array.isArray(existing) ? existing : []).map(normalizeHistoryMessage).filter(Boolean).slice(-MAX_HISTORY);
    const next = (Array.isArray(incoming) ? incoming : []).map(normalizeHistoryMessage).filter(Boolean).slice(-MAX_HISTORY);
    const clearedAt = Number(options.clearedAt || 0);
    if (!next.length && clearedAt > 0) return [];
    if (!current.length) return next;
    if (!next.length) return current;
    if (historyIsPrefix(current, next)) return next;
    if (historyIsPrefix(next, current)) return current;
    const overlapForward = historyTailHeadOverlap(current, next);
    if (overlapForward > 0) return current.concat(next.slice(overlapForward)).slice(-MAX_HISTORY);
    const overlapReverse = historyTailHeadOverlap(next, current);
    if (overlapReverse > 0) return next.concat(current.slice(overlapReverse)).slice(-MAX_HISTORY);
    const sharedPrefix = historyPrefixLength(current, next);
    const prefix = current.slice(0, sharedPrefix);
    const mergedTail = current.slice(sharedPrefix).concat(next.slice(sharedPrefix)).sort((a, b) => { const aTs = Number(a && a.ts) || 0; const bTs = Number(b && b.ts) || 0; return aTs !== bTs ? aTs - bTs : 0; });
    const dedupedTail = []; const seen = new Set();
    mergedTail.forEach((item) => { const key = String(item.ts || 0) + '|' + item.role + '|' + item.content; if (seen.has(key)) return; seen.add(key); dedupedTail.push(item); });
    return prefix.concat(dedupedTail).slice(-MAX_HISTORY);
  }

  const QUOTES_FILE_NAME = 'Quotes.md';
  function normalizeQuoteKey(text, author) {
    return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ') + '|' + String(author || 'Unknown').trim().toLowerCase();
  }
  function isBlockedQuoteEntry(text) { return /ted lasso quotes saved to quotes\.md\s*:/i.test(String(text || '').trim()); }
  function buildQuotesMarkdown(entries) {
    const items = Array.isArray(entries) ? entries.filter((e) => e && String(e.quote || '').trim()) : [];
    if (!items.length) return '';
    const lines = ['# Quotes', '', 'Saved quotes from Homer Motivator and Joey memory. Joey can use these for recall, tone, advice, and preference shaping.', ''];
    items.forEach((entry, index) => {
      const quote = String(entry.quote || '').trim().replace(/^[""']+|[""']+$/g, '');
      const author = String(entry.author || 'Unknown').trim() || 'Unknown';
      const savedAt = String(entry.savedAt || '').trim();
      lines.push('## Quote ' + (index + 1)); lines.push('> "' + quote.replace(/\r?\n+/g, '\n> ') + '"'); lines.push('');
      lines.push('- Author: ' + author); if (savedAt) lines.push('- Saved: ' + savedAt); lines.push('');
    });
    return lines.join('\n').trim() + '\n';
  }
  function extractQuoteEntriesFromMarkdown(markdown) {
    const value = String(markdown || '').replace(/\r\n/g, '\n').trim();
    if (!value) return [];
    const entries = []; const blocks = value.split(/\n(?=##\s+Quote\b)/g);
    blocks.forEach((block) => {
      const quoteMatch = block.match(/^\s*>\s*([\s\S]*?)(?:\n(?:-|##|$))/m);
      const authorMatch = block.match(/^\s*-\s*Author:\s*(.+)$/mi);
      const savedMatch = block.match(/^\s*-\s*Saved:\s*(.+)$/mi);
      const quoteText = quoteMatch ? quoteMatch[1].replace(/\n>\s*/g, '\n').trim() : '';
      const quoteAuthor = authorMatch ? String(authorMatch[1] || '').trim() : 'Unknown';
      const quoteSavedAt = savedMatch ? String(savedMatch[1] || '').trim() : '';
      if (!quoteText) return; entries.push({ quote: quoteText, author: quoteAuthor || 'Unknown', savedAt: quoteSavedAt });
    });
    return entries;
  }
  function mergeQuotesMarkdown(existingMarkdown, incomingMarkdown) {
    const merged = []; const indexByKey = new Map();
    const parseSavedAt = (value) => { const ts = Date.parse(String(value || '').trim()); return Number.isFinite(ts) ? ts : 0; };
    const addEntries = (entries) => {
      entries.forEach((entry) => {
        const quote = String(entry && entry.quote || '').trim();
        if (!quote) return; if (isBlockedQuoteEntry(quote)) return;
        const author = String(entry && entry.author || 'Unknown').trim() || 'Unknown';
        const savedAt = String(entry && entry.savedAt || '').trim();
        const key = normalizeQuoteKey(quote, author);
        const existingIdx = indexByKey.get(key);
        if (existingIdx == null) { indexByKey.set(key, merged.length); merged.push({ quote, author, savedAt }); return; }
        const previous = merged[existingIdx];
        if (parseSavedAt(savedAt) >= parseSavedAt(previous && previous.savedAt)) merged[existingIdx] = { quote, author, savedAt };
      });
    };
    addEntries(extractQuoteEntriesFromMarkdown(existingMarkdown));
    addEntries(extractQuoteEntriesFromMarkdown(incomingMarkdown));
    return buildQuotesMarkdown(merged);
  }
  function isQuoteLikeCategory(category) {
    const value = String(category || '').trim().toLowerCase();
    return ['quote', 'quotes', 'wisdom', 'stoic', 'mantra', 'motto', 'inspiration'].includes(value);
  }
  function buildQuoteMarkdownFromMemory(memory, category) {
    const text = String(memory || '').trim();
    if (!text) return '';
    const quoteMatch = text.match(/^[""](.+?)[""]\s*(?:[-—]\s*(.+))?$/);
    const quote = quoteMatch ? String(quoteMatch[1] || '').trim() : text;
    const author = quoteMatch && quoteMatch[2] ? String(quoteMatch[2] || '').trim() : 'Unknown';
    return buildQuotesMarkdown([{ quote, author, savedAt: new Date().toISOString(), category: category || 'quote' }]);
  }
  function sanitizeManagedCustomFiles(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const out = {};
    Object.entries(source).forEach(([name, content]) => {
      const safeName = String(name || '').trim();
      if (!safeName || /^Preserved\//i.test(safeName)) return;
      if (typeof content !== 'string' || !content.trim()) return;
      out[safeName] = safeName === QUOTES_FILE_NAME ? mergeQuotesMarkdown('', content) : content.trim();
    });
    return out;
  }
  function resolveManagedGeneratedAt(syncMeta, fallback) {
    const stable = String((syncMeta && (syncMeta.lastCommittedAt || syncMeta.updatedAt || syncMeta.lastDriveBackupAt || syncMeta.lastDriveReconcileAt)) || fallback || new Date().toISOString()).trim();
    return stable || new Date().toISOString();
  }
  function sanitizeManagedFiles(value, fileLibrary, customFiles, generatedAt) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const cleaned = {};
    Object.entries(source).forEach(([name, content]) => { const safeName = String(name || '').trim(); if (!safeName || /^Preserved\//i.test(safeName)) return; cleaned[safeName] = content; });
    return mergeDerivedFileContext(cleaned, Array.isArray(fileLibrary) ? fileLibrary : [], sanitizeManagedCustomFiles(customFiles), generatedAt || new Date().toISOString());
  }

  try {
    const action = searchParams.get('action');

    // --- HISTORY ACTIONS ---
    if (action === 'history') {
      if (request.method === 'GET') {
        const [result, syncMetaResult] = await Promise.all([redis(['GET', HISTORY_KEY]), redis(['GET', SYNC_META_KEY])]);
        const history = result.result ? JSON.parse(result.result) : [];
        const syncMeta = syncMetaResult.result ? JSON.parse(syncMetaResult.result) : {};
        return Response.json({ history, syncMeta, updatedAt: syncMeta && syncMeta.updatedAt ? syncMeta.updatedAt : null }, { status: 200, headers: corsHeaders });
      }
      if (request.method === 'POST') {
        const { messages, chatClearedAt } = body || {};
        if (!messages || !Array.isArray(messages)) return Response.json({ error: 'Missing messages array' }, { status: 400, headers: corsHeaders });
        const [previous, syncMetaExisting] = await Promise.all([loadRedisJson(redis, HISTORY_KEY, []), loadRedisJson(redis, SYNC_META_KEY, {})]);
        const cleaned = messages.map(normalizeHistoryMessage).filter(Boolean).slice(-MAX_HISTORY);
        const merged = mergeHistoryMessages(previous, cleaned, { clearedAt: chatClearedAt });
        await redis(['SET', HISTORY_KEY, JSON.stringify(merged)]);
        const journalEntries = [];
        const prevNormalized = Array.isArray(previous) ? previous : [];
        const prevLooksPrefix = historyIsPrefix(prevNormalized, merged);
        if (prevLooksPrefix) {
          merged.slice(prevNormalized.length).forEach((item) => journalEntries.push(buildJournalEntry('message', { role: item.role, text: item.content, source: 'history-sync' })));
        } else if (!merged.length && Number(chatClearedAt || 0) > 0) {
          journalEntries.push(buildJournalEntry('history-cleared', { text: 'Chat cleared', source: 'history-sync', ts: Number(chatClearedAt) || Date.now() }));
        } else {
          journalEntries.push(buildJournalEntry('history-rewrite', { text: JSON.stringify(merged.slice(-8)), source: 'history-sync' }));
        }
        await appendJournalEntries(journalEntries);
        const updatedAt = new Date().toISOString();
        const nextSyncMeta = buildSyncMetaDevicePatch(syncMetaExisting, updatedAt, 'history-sync');
        await saveRedisJson(redis, SYNC_META_KEY, nextSyncMeta);
        return Response.json({ ok: true, count: merged.length, updatedAt, syncMeta: nextSyncMeta }, { status: 200, headers: corsHeaders });
      }
      return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
    }

    // --- MEMORY ACTIONS ---
    if (action === 'memory') {
      if (request.method === 'GET') {
        const result = await redis(['GET', MEMORY_KEY]);
        const memories = result.result ? JSON.parse(result.result) : [];
        return Response.json({ memories }, { status: 200, headers: corsHeaders });
      }
      if (request.method === 'POST') {
        const { memory, category, source, confidence, pinned } = body || {};
        if (!memory) return Response.json({ error: 'Missing memory' }, { status: 400, headers: corsHeaders });
        const [result, customFilesResult, filesResult, profileResult, historyResult, libraryResult, syncMetaResult] = await Promise.all([
          redis(['GET', MEMORY_KEY]), redis(['GET', CUSTOM_FILES_KEY]), redis(['GET', FILES_KEY]), redis(['GET', PROFILE_KEY]),
          redis(['GET', HISTORY_KEY]), redis(['GET', FILE_LIBRARY_KEY]), redis(['GET', SYNC_META_KEY])
        ]);
        const memories = result.result ? JSON.parse(result.result) : [];
        memories.push({ id: Date.now(), text: memory, category: category || 'general', ts: Date.now(), source: source || 'manual', confidence: typeof confidence === 'number' ? Math.max(0, Math.min(1, confidence)) : undefined, pinned: !!pinned || /^(direct-user-remember|implicit-profile-remember)$/i.test(String(source || '')) });
        while (memories.length > MAX_MEMORIES) memories.shift();
        const customFiles = sanitizeManagedCustomFiles(customFilesResult.result ? JSON.parse(customFilesResult.result) : {});
        const fileLibrary = libraryResult.result ? JSON.parse(libraryResult.result) : [];
        const currentProfile = profileResult.result ? JSON.parse(profileResult.result) : {};
        const history = historyResult.result ? JSON.parse(historyResult.result) : [];
        const generatedAt = new Date().toISOString();
        const profile = applyDeterministicProfileMemory(currentProfile, memory, category);
        const existingFiles = sanitizeManagedFiles(filesResult.result ? JSON.parse(filesResult.result) : {}, fileLibrary, customFiles, generatedAt);
        let files = existingFiles;
        if (isQuoteLikeCategory(category)) {
          const nextQuoteContent = mergeQuotesMarkdown(customFiles[QUOTES_FILE_NAME], buildQuoteMarkdownFromMemory(memory, category));
          if (nextQuoteContent) customFiles[QUOTES_FILE_NAME] = nextQuoteContent;
        }
        files = buildContextFiles({ profile, memories, history, tasks: [], fileLibrary, existingFiles, customFiles, scope: mode, generatedAt });
        const storedSyncMeta = syncMetaResult.result ? JSON.parse(syncMetaResult.result) : {};
        const syncMeta = computeJoeySyncMeta({ mode, profile, memories, history, files, fileLibrary, customFiles, journal: [] }, { ...buildSyncMetaDevicePatch(storedSyncMeta, generatedAt, 'memory-action') });
        await Promise.all([redis(['SET', MEMORY_KEY, JSON.stringify(memories)]), redis(['SET', PROFILE_KEY, JSON.stringify(profile)]), redis(['SET', CUSTOM_FILES_KEY, JSON.stringify(customFiles)]), redis(['SET', FILES_KEY, JSON.stringify(files)]), redis(['SET', SYNC_META_KEY, JSON.stringify(syncMeta)])]);
        await appendJournalEntries([buildJournalEntry('memory-added', { text: memory, category: category || 'general', source: source || 'manual' })]);
        return Response.json({ ok: true, count: memories.length, profileUpdated: JSON.stringify(profile) !== JSON.stringify(currentProfile), updatedAt: generatedAt, syncMeta }, { status: 200, headers: corsHeaders });
      }
      if (request.method === 'DELETE') {
        const { memoryId, match } = body || {};
        const result = await redis(['GET', MEMORY_KEY]);
        let memories = result.result ? JSON.parse(result.result) : [];
        if (memoryId) { memories = memories.filter(m => m.id !== memoryId); }
        else if (match) { const lower = match.toLowerCase(); memories = memories.filter(m => !m.text.toLowerCase().includes(lower)); }
        else { return Response.json({ error: 'Missing memoryId or match' }, { status: 400, headers: corsHeaders }); }
        await redis(['SET', MEMORY_KEY, JSON.stringify(memories)]);
        await appendJournalEntries([buildJournalEntry('memory-removed', { text: String(match || memoryId || ''), source: 'manual' })]);
        return Response.json({ ok: true, count: memories.length }, { status: 200, headers: corsHeaders });
      }
      return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
    }

    // --- PROFILE ACTION ---
    if (action === 'profile') {
      if (request.method === 'GET') {
        const result = await redis(['GET', PROFILE_KEY]);
        const profile = result.result ? JSON.parse(result.result) : {};
        return Response.json({ profile }, { status: 200, headers: corsHeaders });
      }
      return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
    }

    if (action === 'bundle') {
      if (request.method === 'GET') {
        const [profileRes, memoryRes, historyRes, filesRes, libraryRes, customFilesRes, journalRes, syncMetaRes] = await Promise.all([redis(['GET', PROFILE_KEY]), redis(['GET', MEMORY_KEY]), redis(['GET', HISTORY_KEY]), redis(['GET', FILES_KEY]), redis(['GET', FILE_LIBRARY_KEY]), redis(['GET', CUSTOM_FILES_KEY]), redis(['GET', JOURNAL_KEY]), redis(['GET', SYNC_META_KEY])]);
        const fileLibrary = libraryRes.result ? JSON.parse(libraryRes.result) : [];
        const customFiles = sanitizeManagedCustomFiles(customFilesRes.result ? JSON.parse(customFilesRes.result) : {});
        const bundle = { mode, exportedAt: Date.now(), profile: profileRes.result ? JSON.parse(profileRes.result) : {}, memories: memoryRes.result ? JSON.parse(memoryRes.result) : [], history: historyRes.result ? JSON.parse(historyRes.result) : [], files: sanitizeManagedFiles(filesRes.result ? JSON.parse(filesRes.result) : {}, fileLibrary, customFiles, new Date().toISOString()), fileLibrary, customFiles, journal: journalRes.result ? JSON.parse(journalRes.result) : [] };
        const storedSyncMeta = syncMetaRes.result ? JSON.parse(syncMetaRes.result) : null;
        bundle.syncMeta = storedSyncMeta && typeof storedSyncMeta === 'object' ? storedSyncMeta : computeJoeySyncMeta(bundle, { mode, lastSource: 'bundle-export' });
        return Response.json({ ok: true, bundle }, { status: 200, headers: corsHeaders });
      }
      if (request.method === 'POST') {
        const bundleData = body && body.bundle;
        if (!bundleData || typeof bundleData !== 'object') return Response.json({ error: 'Missing bundle' }, { status: 400, headers: corsHeaders });
        if (bundleData.mode && String(bundleData.mode).trim() && String(bundleData.mode).trim() !== mode) return Response.json({ error: 'Bundle mode mismatch', expectedMode: mode, bundleMode: String(bundleData.mode).trim() }, { status: 409, headers: corsHeaders });
        const profile = bundleData.profile && typeof bundleData.profile === 'object' ? bundleData.profile : {};
        const memories = Array.isArray(bundleData.memories) ? bundleData.memories : [];
        const history = Array.isArray(bundleData.history) ? bundleData.history : [];
        const fileLibrary = Array.isArray(bundleData.fileLibrary) ? bundleData.fileLibrary : [];
        const customFiles = sanitizeManagedCustomFiles(bundleData.customFiles);
        const files = sanitizeManagedFiles(bundleData.files, fileLibrary, customFiles, new Date().toISOString());
        const journal = Array.isArray(bundleData.journal) ? bundleData.journal : [];
        const syncMeta = bundleData.syncMeta && typeof bundleData.syncMeta === 'object' ? bundleData.syncMeta : computeJoeySyncMeta({ mode, profile, memories, history, files, fileLibrary, customFiles, journal }, { mode, lastSource: 'bundle-restore' });
        await Promise.all([redis(['SET', PROFILE_KEY, JSON.stringify(profile)]), redis(['SET', MEMORY_KEY, JSON.stringify(memories.slice(-MAX_MEMORIES))]), redis(['SET', HISTORY_KEY, JSON.stringify(history.filter(m => m && (m.role === 'user' || m.role === 'assistant')).slice(-MAX_HISTORY))]), redis(['SET', FILES_KEY, JSON.stringify(files)]), redis(['SET', FILE_LIBRARY_KEY, JSON.stringify(fileLibrary)]), redis(['SET', CUSTOM_FILES_KEY, JSON.stringify(customFiles)]), redis(['SET', JOURNAL_KEY, JSON.stringify(journal.slice(-MAX_JOURNAL))]), redis(['SET', SYNC_META_KEY, JSON.stringify(syncMeta)])]);
        return Response.json({ ok: true, restored: { mode, memories: memories.length, history: history.length, fileLibrary: fileLibrary.length, customFiles: Object.keys(customFiles).length, journal: journal.length } }, { status: 200, headers: corsHeaders });
      }
      return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
    }

    if (action === 'sync-meta') {
      if (request.method === 'GET') {
        const [syncMetaRes, profileLenRes, memoryLenRes, historyLenRes, filesLenRes, libraryLenRes, customFilesLenRes, journalLenRes] = await Promise.all([redis(['GET', SYNC_META_KEY]), redis(['STRLEN', PROFILE_KEY]), redis(['STRLEN', MEMORY_KEY]), redis(['STRLEN', HISTORY_KEY]), redis(['STRLEN', FILES_KEY]), redis(['STRLEN', FILE_LIBRARY_KEY]), redis(['STRLEN', CUSTOM_FILES_KEY]), redis(['STRLEN', JOURNAL_KEY])]);
        const storedSyncMeta = syncMetaRes.result ? JSON.parse(syncMetaRes.result) : {};
        const hasStoredMeta = !!(storedSyncMeta && storedSyncMeta.hashes && storedSyncMeta.counts);
        if (hasStoredMeta) {
          const stats = { planBytes: REDIS_PLAN_BYTES, keyCount: 8, bundleBytes: (parseInt(profileLenRes && profileLenRes.result, 10) || 0) + (parseInt(memoryLenRes && memoryLenRes.result, 10) || 0) + (parseInt(historyLenRes && historyLenRes.result, 10) || 0) + (parseInt(filesLenRes && filesLenRes.result, 10) || 0) + (parseInt(libraryLenRes && libraryLenRes.result, 10) || 0) + (parseInt(customFilesLenRes && customFilesLenRes.result, 10) || 0) + (parseInt(journalLenRes && journalLenRes.result, 10) || 0) + measureJsonBytes(storedSyncMeta), memoryCount: Number((storedSyncMeta.counts && storedSyncMeta.counts.memories) || 0), historyCount: Number((storedSyncMeta.counts && storedSyncMeta.counts.history) || 0), fileCount: Number((storedSyncMeta.counts && storedSyncMeta.counts.files) || 0), customFileCount: Number((storedSyncMeta.counts && storedSyncMeta.counts.customFiles) || 0), uploadCount: Number((storedSyncMeta.counts && storedSyncMeta.counts.fileLibrary) || 0), journalCount: Number((storedSyncMeta.counts && storedSyncMeta.counts.journal) || 0) };
          stats.bundleMegabytes = Number((stats.bundleBytes / (1024 * 1024)).toFixed(3));
          stats.planUtilizationPct = Number(((stats.bundleBytes / REDIS_PLAN_BYTES) * 100).toFixed(3));
          return Response.json({ ok: true, syncMeta: storedSyncMeta, stats }, { status: 200, headers: corsHeaders });
        }
        const [profileRes, memoryRes, historyRes, filesRes, libraryRes, customFilesRes, journalRes] = await Promise.all([redis(['GET', PROFILE_KEY]), redis(['GET', MEMORY_KEY]), redis(['GET', HISTORY_KEY]), redis(['GET', FILES_KEY]), redis(['GET', FILE_LIBRARY_KEY]), redis(['GET', CUSTOM_FILES_KEY]), redis(['GET', JOURNAL_KEY])]);
        const generatedAt = resolveManagedGeneratedAt(storedSyncMeta);
        const bundle = { mode, profile: profileRes.result ? JSON.parse(profileRes.result) : {}, memories: memoryRes.result ? JSON.parse(memoryRes.result) : [], history: historyRes.result ? JSON.parse(historyRes.result) : [], files: sanitizeManagedFiles(filesRes.result ? JSON.parse(filesRes.result) : {}, libraryRes.result ? JSON.parse(libraryRes.result) : [], customFilesRes.result ? JSON.parse(customFilesRes.result) : {}, generatedAt), fileLibrary: libraryRes.result ? JSON.parse(libraryRes.result) : [], customFiles: sanitizeManagedCustomFiles(customFilesRes.result ? JSON.parse(customFilesRes.result) : {}), journal: journalRes.result ? JSON.parse(journalRes.result) : [] };
        const syncMeta = computeJoeySyncMeta(bundle, { ...storedSyncMeta, mode, updatedAt: storedSyncMeta && storedSyncMeta.updatedAt ? storedSyncMeta.updatedAt : generatedAt });
        const stats = { planBytes: REDIS_PLAN_BYTES, keyCount: 8, bundleBytes: measureJsonBytes(bundle.profile) + measureJsonBytes(bundle.memories) + measureJsonBytes(bundle.history) + measureJsonBytes(bundle.files) + measureJsonBytes(bundle.fileLibrary) + measureJsonBytes(bundle.customFiles) + measureJsonBytes(bundle.journal) + measureJsonBytes(syncMeta), memoryCount: Array.isArray(bundle.memories) ? bundle.memories.length : 0, historyCount: Array.isArray(bundle.history) ? bundle.history.length : 0, fileCount: bundle.files && typeof bundle.files === 'object' ? Object.keys(bundle.files).length : 0, customFileCount: bundle.customFiles && typeof bundle.customFiles === 'object' ? Object.keys(bundle.customFiles).length : 0, uploadCount: Array.isArray(bundle.fileLibrary) ? bundle.fileLibrary.length : 0, journalCount: Array.isArray(bundle.journal) ? bundle.journal.length : 0 };
        stats.bundleMegabytes = Number((stats.bundleBytes / (1024 * 1024)).toFixed(3));
        stats.planUtilizationPct = Number(((stats.bundleBytes / REDIS_PLAN_BYTES) * 100).toFixed(3));
        return Response.json({ ok: true, syncMeta, stats }, { status: 200, headers: corsHeaders });
      }
      return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
    }

    if (action === 'journal') {
      if (request.method === 'GET') {
        const journal = await loadJournal();
        return Response.json({ ok: true, journal }, { status: 200, headers: corsHeaders });
      }
      return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
    }

    if (action === 'files') {
      if (request.method === 'GET') {
        const [result, libraryResult, customResult, syncMetaRes] = await Promise.all([redis(['GET', FILES_KEY]), redis(['GET', FILE_LIBRARY_KEY]), redis(['GET', CUSTOM_FILES_KEY]), redis(['GET', SYNC_META_KEY])]);
        const fileLibrary = libraryResult.result ? JSON.parse(libraryResult.result) : [];
        const customFiles = sanitizeManagedCustomFiles(customResult.result ? JSON.parse(customResult.result) : {});
        const syncMeta = syncMetaRes.result ? JSON.parse(syncMetaRes.result) : {};
        const files = sanitizeManagedFiles(result.result ? JSON.parse(result.result) : {}, fileLibrary, customFiles, resolveManagedGeneratedAt(syncMeta));
        return Response.json({ files }, { status: 200, headers: corsHeaders });
      }
      if (request.method === 'POST') {
        const { tasks, savedQuotesContent } = body || {};
        const effectiveTasks = mode === 'work' ? [] : (Array.isArray(tasks) ? tasks : []);
        const [memRes, profileRes, histRes, filesRes, libraryRes, customFilesRes, syncMetaRes] = await Promise.all([redis(['GET', MEMORY_KEY]), redis(['GET', PROFILE_KEY]), redis(['GET', HISTORY_KEY]), redis(['GET', FILES_KEY]), redis(['GET', FILE_LIBRARY_KEY]), redis(['GET', CUSTOM_FILES_KEY]), redis(['GET', SYNC_META_KEY])]);
        const existingCustomFiles = sanitizeManagedCustomFiles(customFilesRes.result ? JSON.parse(customFilesRes.result) : {});
        let memories = memRes.result ? JSON.parse(memRes.result) : [];
        if (!Array.isArray(memories)) memories = [];
        const baseMemories = memories.filter((entry) => !(entry && entry.source === 'saved-quotes-sync'));
        let quoteMemories = null; let savedQuotesChanged = false;
        if (typeof savedQuotesContent === 'string') {
          const currentQuotes = String(existingCustomFiles[QUOTES_FILE_NAME] || '');
          const incomingQuotes = String(savedQuotesContent || '');
          const normalizedQuotes = incomingQuotes.trim() ? mergeQuotesMarkdown(currentQuotes, incomingQuotes) : currentQuotes;
          if (normalizedQuotes.trim()) existingCustomFiles[QUOTES_FILE_NAME] = normalizedQuotes;
          else if (incomingQuotes.trim()) delete existingCustomFiles[QUOTES_FILE_NAME];
          savedQuotesChanged = currentQuotes !== String(existingCustomFiles[QUOTES_FILE_NAME] || '');
          const quoteEntries = extractQuoteEntriesFromMarkdown(existingCustomFiles[QUOTES_FILE_NAME] || '').slice(-120);
          quoteMemories = quoteEntries.map((entry, idx) => ({ id: Date.now() + idx, text: '"' + String(entry.quote || '').trim() + '" — ' + (String(entry.author || 'Unknown').trim() || 'Unknown'), category: 'quote', ts: entry.savedAt ? Date.parse(entry.savedAt) || Date.now() : Date.now(), source: 'saved-quotes-sync', confidence: 0.98 }));
          memories = baseMemories.concat(quoteMemories).slice(-MAX_MEMORIES);
        }
        const currentSyncMeta = syncMetaRes.result ? JSON.parse(syncMetaRes.result) : {};
        const generatedAt = new Date().toISOString();
        const existingFiles = sanitizeManagedFiles(filesRes.result ? JSON.parse(filesRes.result) : {}, libraryRes.result ? JSON.parse(libraryRes.result) : [], existingCustomFiles, generatedAt);
        const generatedFiles = buildContextFiles({ profile: profileRes.result ? JSON.parse(profileRes.result) : {}, memories, history: histRes.result ? JSON.parse(histRes.result) : [], tasks: effectiveTasks, fileLibrary: libraryRes.result ? JSON.parse(libraryRes.result) : [], existingFiles, customFiles: existingCustomFiles, scope: mode, generatedAt });
        const preserved = preserveGeneratedContextFiles(existingFiles, generatedFiles, existingCustomFiles, new Date().toISOString());
        const nextSyncMeta = computeJoeySyncMeta({ mode, profile: profileRes.result ? JSON.parse(profileRes.result) : {}, memories, history: histRes.result ? JSON.parse(histRes.result) : [], files: preserved.files, fileLibrary: libraryRes.result ? JSON.parse(libraryRes.result) : [], customFiles: preserved.customFiles, journal: [] }, { mode, updatedAt: generatedAt, lastCommittedAt: currentSyncMeta && currentSyncMeta.lastCommittedAt ? currentSyncMeta.lastCommittedAt : null, lastDriveBackupAt: currentSyncMeta && currentSyncMeta.lastDriveBackupAt ? currentSyncMeta.lastDriveBackupAt : null, lastDriveReconcileAt: currentSyncMeta && currentSyncMeta.lastDriveReconcileAt ? currentSyncMeta.lastDriveReconcileAt : null, lastSource: 'files-refresh' });
        await Promise.all([redis(['SET', FILES_KEY, JSON.stringify(preserved.files)]), redis(['SET', CUSTOM_FILES_KEY, JSON.stringify(preserved.customFiles)]), (typeof savedQuotesContent === 'string' || savedQuotesChanged) ? redis(['SET', MEMORY_KEY, JSON.stringify(memories)]) : Promise.resolve(), redis(['SET', SYNC_META_KEY, JSON.stringify(nextSyncMeta)])]);
        return Response.json({ ok: true, files: preserved.files, preserved: Object.keys(preserved.customFiles).length - Object.keys(existingCustomFiles || {}).length }, { status: 200, headers: corsHeaders });
      }
      return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
    }

    if (action === 'file-library') {
      if (request.method === 'GET') {
        const result = await redis(['GET', FILE_LIBRARY_KEY]);
        const files = result.result ? JSON.parse(result.result) : [];
        return Response.json({ files }, { status: 200, headers: corsHeaders });
      }
      return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
    }

    if (action === 'custom-files') {
      if (request.method === 'GET') {
        const result = await redis(['GET', CUSTOM_FILES_KEY]);
        const customFiles = sanitizeManagedCustomFiles(result.result ? JSON.parse(result.result) : {});
        return Response.json({ customFiles }, { status: 200, headers: corsHeaders });
      }
      if (request.method === 'POST') {
        const { name, content, replace } = body || {};
        if (!name || typeof content !== 'string') return Response.json({ error: 'Missing name or content' }, { status: 400, headers: corsHeaders });
        const safeName = String(name).trim().replace(/\.\./g, '').replace(/^\/+/, '').slice(0, 200);
        if (!safeName) return Response.json({ error: 'Invalid file name' }, { status: 400, headers: corsHeaders });
        const [result, filesResult, memoriesResult, syncMetaRes, profileRes, historyRes, libraryRes, journalRes] = await Promise.all([redis(['GET', CUSTOM_FILES_KEY]), redis(['GET', FILES_KEY]), redis(['GET', MEMORY_KEY]), redis(['GET', SYNC_META_KEY]), redis(['GET', PROFILE_KEY]), redis(['GET', HISTORY_KEY]), redis(['GET', FILE_LIBRARY_KEY]), redis(['GET', JOURNAL_KEY])]);
        const customFiles = sanitizeManagedCustomFiles(result.result ? JSON.parse(result.result) : {});
        const syncMeta = syncMetaRes.result ? JSON.parse(syncMetaRes.result) : {};
        const generatedAt = new Date().toISOString();
        const files = sanitizeManagedFiles(filesResult.result ? JSON.parse(filesResult.result) : {}, [], customFiles, generatedAt);
        let memories = memoriesResult.result ? JSON.parse(memoriesResult.result) : [];
        if (!Array.isArray(memories)) memories = [];
        const baseMemories = memories.filter((entry) => !(entry && entry.source === 'saved-quotes-sync'));
        let quoteMemories = null; let contentChanged = false;
        if (!content.trim()) {
          contentChanged = !!customFiles[safeName] || !!files[safeName];
          delete customFiles[safeName]; delete files[safeName];
          if (safeName === QUOTES_FILE_NAME) memories = baseMemories;
        } else {
          const nextContent = safeName === QUOTES_FILE_NAME ? (replace ? mergeQuotesMarkdown('', content) : mergeQuotesMarkdown(customFiles[safeName], content)) : content.trim().slice(0, 50000);
          contentChanged = String(customFiles[safeName] || '') !== String(nextContent || '');
          customFiles[safeName] = nextContent; files[safeName] = customFiles[safeName];
          if (safeName === QUOTES_FILE_NAME) {
            const quoteEntries = extractQuoteEntriesFromMarkdown(nextContent).slice(-120);
            quoteMemories = quoteEntries.map((entry, idx) => ({ id: Date.now() + idx, text: '"' + String(entry.quote || '').trim() + '" — ' + (String(entry.author || 'Unknown').trim() || 'Unknown'), category: 'quote', ts: entry.savedAt ? Date.parse(entry.savedAt) || Date.now() : Date.now(), source: 'saved-quotes-sync', confidence: 0.98 }));
            memories = baseMemories.concat(quoteMemories).slice(-MAX_MEMORIES);
          }
        }
        if (!contentChanged) {
          if (safeName === QUOTES_FILE_NAME) {
            const existingSavedQuoteMemories = memories.filter((entry) => entry && entry.source === 'saved-quotes-sync');
            const nextSavedQuoteMemories = Array.isArray(quoteMemories) ? quoteMemories : [];
            const existingFingerprint = JSON.stringify(existingSavedQuoteMemories.map((entry) => ({ text: String(entry.text || ''), category: String(entry.category || ''), source: String(entry.source || '') })));
            const nextFingerprint = JSON.stringify(nextSavedQuoteMemories.map((entry) => ({ text: String(entry.text || ''), category: String(entry.category || ''), source: String(entry.source || '') })));
            if (existingFingerprint !== nextFingerprint) await redis(['SET', MEMORY_KEY, JSON.stringify(baseMemories.concat(nextSavedQuoteMemories).slice(-MAX_MEMORIES))]);
          }
          return Response.json({ ok: true, name: safeName, count: Object.keys(customFiles).length, unchanged: true }, { status: 200, headers: corsHeaders });
        }
        await Promise.all([redis(['SET', CUSTOM_FILES_KEY, JSON.stringify(customFiles)]), redis(['SET', FILES_KEY, JSON.stringify(files)]), safeName === QUOTES_FILE_NAME ? redis(['SET', MEMORY_KEY, JSON.stringify(memories)]) : Promise.resolve(), redis(['SET', SYNC_META_KEY, JSON.stringify(computeJoeySyncMeta({ mode, profile: profileRes.result ? JSON.parse(profileRes.result) : {}, memories, history: historyRes.result ? JSON.parse(historyRes.result) : [], files, fileLibrary: libraryRes.result ? JSON.parse(libraryRes.result) : [], customFiles, journal: journalRes.result ? JSON.parse(journalRes.result) : [] }, { mode, updatedAt: generatedAt, lastCommittedAt: syncMeta && syncMeta.lastCommittedAt ? syncMeta.lastCommittedAt : null, lastDriveBackupAt: syncMeta && syncMeta.lastDriveBackupAt ? syncMeta.lastDriveBackupAt : null, lastDriveReconcileAt: syncMeta && syncMeta.lastDriveReconcileAt ? syncMeta.lastDriveReconcileAt : null, lastSource: 'custom-file-update' }))])]);
        return Response.json({ ok: true, name: safeName, count: Object.keys(customFiles).length }, { status: 200, headers: corsHeaders });
      }
      if (request.method === 'DELETE') {
        const { name } = body || {};
        if (!name) return Response.json({ error: 'Missing name' }, { status: 400, headers: corsHeaders });
        const [result, filesResult, memoriesResult, syncMetaRes, profileRes, historyRes, libraryRes, journalRes] = await Promise.all([redis(['GET', CUSTOM_FILES_KEY]), redis(['GET', FILES_KEY]), redis(['GET', MEMORY_KEY]), redis(['GET', SYNC_META_KEY]), redis(['GET', PROFILE_KEY]), redis(['GET', HISTORY_KEY]), redis(['GET', FILE_LIBRARY_KEY]), redis(['GET', JOURNAL_KEY])]);
        const customFiles = sanitizeManagedCustomFiles(result.result ? JSON.parse(result.result) : {});
        const syncMeta = syncMetaRes.result ? JSON.parse(syncMetaRes.result) : {};
        const generatedAt = new Date().toISOString();
        const files = sanitizeManagedFiles(filesResult.result ? JSON.parse(filesResult.result) : {}, [], customFiles, generatedAt);
        const targetName = String(name).trim();
        const existed = !!customFiles[targetName] || !!files[targetName];
        delete customFiles[targetName]; delete files[targetName];
        let memories = memoriesResult.result ? JSON.parse(memoriesResult.result) : [];
        if (!Array.isArray(memories)) memories = [];
        if (targetName === QUOTES_FILE_NAME) memories = memories.filter((entry) => !(entry && entry.source === 'saved-quotes-sync'));
        if (!existed && targetName !== QUOTES_FILE_NAME) return Response.json({ ok: true, count: Object.keys(customFiles).length, unchanged: true }, { status: 200, headers: corsHeaders });
        await Promise.all([redis(['SET', CUSTOM_FILES_KEY, JSON.stringify(customFiles)]), redis(['SET', FILES_KEY, JSON.stringify(files)]), targetName === QUOTES_FILE_NAME ? redis(['SET', MEMORY_KEY, JSON.stringify(memories)]) : Promise.resolve(), redis(['SET', SYNC_META_KEY, JSON.stringify(computeJoeySyncMeta({ mode, profile: profileRes.result ? JSON.parse(profileRes.result) : {}, memories, history: historyRes.result ? JSON.parse(historyRes.result) : [], files, fileLibrary: libraryRes.result ? JSON.parse(libraryRes.result) : [], customFiles, journal: journalRes.result ? JSON.parse(journalRes.result) : [] }, { mode, updatedAt: generatedAt, lastCommittedAt: syncMeta && syncMeta.lastCommittedAt ? syncMeta.lastCommittedAt : null, lastDriveBackupAt: syncMeta && syncMeta.lastDriveBackupAt ? syncMeta.lastDriveBackupAt : null, lastDriveReconcileAt: syncMeta && syncMeta.lastDriveReconcileAt ? syncMeta.lastDriveReconcileAt : null, lastSource: 'custom-file-delete' }))])]);
        return Response.json({ ok: true, count: Object.keys(customFiles).length }, { status: 200, headers: corsHeaders });
      }
      return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
    }

    if (action === 'learn' && request.method === 'POST') {
      const { messages } = body || {};
      if (!messages || !Array.isArray(messages) || messages.length < 2) return Response.json({ error: 'Need at least 2 messages' }, { status: 400, headers: corsHeaders });
      const cleanedMessages = messages.filter((item) => item && (item.role === 'user' || item.role === 'assistant')).map((item) => ({ role: item.role, content: String(item.content || '').slice(0, 2000) })).slice(-MAX_HISTORY);
      const learnOutcome = await runLearnStep({ mode, messages: cleanedMessages, redisFetch: redis, keys: { MEMORY_KEY, PROFILE_KEY } });
      if (learnOutcome && learnOutcome.ok && Array.isArray(learnOutcome.facts) && learnOutcome.facts.length) {
        await appendJournalEntries(learnOutcome.facts.map((fact) => buildJournalEntry('memory-learned', { text: fact, source: 'auto-learn' })));
      }
      const [currentProfile, currentMemories, currentHistory, currentFiles, currentFileLibrary, currentCustomFiles, currentJournal, currentSyncMeta] = await Promise.all([loadRedisJson(redis, PROFILE_KEY, {}), loadRedisJson(redis, MEMORY_KEY, []), loadRedisJson(redis, HISTORY_KEY, []), loadRedisJson(redis, FILES_KEY, {}), loadRedisJson(redis, FILE_LIBRARY_KEY, []), loadRedisJson(redis, CUSTOM_FILES_KEY, {}), loadRedisJson(redis, JOURNAL_KEY, []), loadRedisJson(redis, SYNC_META_KEY, {})]);
      const learnedAt = new Date().toISOString();
      const rebuiltFiles = preserveGeneratedContextFiles(currentFiles, buildContextFiles({ profile: currentProfile, memories: currentMemories, history: currentHistory, tasks: [], fileLibrary: currentFileLibrary, existingFiles: currentFiles, customFiles: currentCustomFiles, scope: mode, generatedAt: learnedAt }), currentCustomFiles, learnedAt).files;
      await saveRedisJson(redis, FILES_KEY, rebuiltFiles);
      const nextSyncMeta = computeJoeySyncMeta({ mode, profile: currentProfile, memories: currentMemories, history: currentHistory, files: rebuiltFiles, fileLibrary: currentFileLibrary, customFiles: currentCustomFiles, journal: currentJournal }, { mode, updatedAt: learnedAt, lastCommittedAt: currentSyncMeta && currentSyncMeta.lastCommittedAt ? currentSyncMeta.lastCommittedAt : null, lastDriveBackupAt: currentSyncMeta && currentSyncMeta.lastDriveBackupAt ? currentSyncMeta.lastDriveBackupAt : null, lastDriveReconcileAt: currentSyncMeta && currentSyncMeta.lastDriveReconcileAt ? currentSyncMeta.lastDriveReconcileAt : null, driveExportedAt: currentSyncMeta && currentSyncMeta.driveExportedAt ? currentSyncMeta.driveExportedAt : null, lastSource: 'learn' });
      await saveRedisJson(redis, SYNC_META_KEY, nextSyncMeta);
      return Response.json({ ...learnOutcome, syncMetaUpdated: true, filesUpdated: true, totalJournalEntries: Array.isArray(currentJournal) ? currentJournal.length : 0 }, { status: 200, headers: corsHeaders });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400, headers: corsHeaders });
  } catch (err) {
    console.error('[joey]', err);
    return Response.json({ error: err.message || 'Unknown error' }, { status: 500, headers: corsHeaders });
  }
}

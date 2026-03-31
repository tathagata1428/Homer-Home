import { buildContextFiles, mergeDerivedFileContext, preserveGeneratedContextFiles } from '../lib/context-files.js';
import handleJoeyCommit, { runLearnStep } from '../lib/joey-commit-handler.js';
import { getJoeyContextKeys, getJoeyMode } from '../lib/joey-context.js';
import { loadRedisJson, saveRedisJson, safeJsonParse } from '../lib/joey-server.js';
import { computeJoeySyncMeta } from '../lib/joey-sync-meta.js';

function sanitizeManagedCustomFiles(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const out = {};
  Object.entries(source).forEach(([name, content]) => {
    const safeName = String(name || '').trim();
    if (!safeName || /^Preserved\//i.test(safeName)) return;
    if (typeof content !== 'string' || !content.trim()) return;
    out[safeName] = safeName === QUOTES_FILE_NAME
      ? mergeQuotesMarkdown('', content)
      : content.trim();
  });
  return out;
}

function sanitizeManagedFiles(value, fileLibrary, customFiles, generatedAt) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const cleaned = {};
  Object.entries(source).forEach(([name, content]) => {
    const safeName = String(name || '').trim();
    if (!safeName || /^Preserved\//i.test(safeName)) return;
    cleaned[safeName] = content;
  });
  return mergeDerivedFileContext(cleaned, Array.isArray(fileLibrary) ? fileLibrary : [], sanitizeManagedCustomFiles(customFiles), generatedAt || new Date().toISOString());
}

const QUOTES_FILE_NAME = 'Quotes.md';

function normalizeQuoteKey(text, author) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ') + '|' + String(author || 'Unknown').trim().toLowerCase();
}

function isBlockedQuoteEntry(text) {
  return /ted lasso quotes saved to quotes\.md\s*:/i.test(String(text || '').trim());
}

extractQuoteEntriesFromMarkdown = function(markdown) {
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
      if (isBlockedQuoteEntry(quote)) return;
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

function isQuoteLikeCategory(category) {
  const value = String(category || '').trim().toLowerCase();
  return ['quote', 'quotes', 'wisdom', 'stoic', 'mantra', 'motto', 'inspiration'].includes(value);
};

buildQuoteMarkdownFromMemory = function(memory, category) {
  const text = String(memory || '').trim();
  if (!text) return '';
  const quoteMatch = text.match(/^["“](.+?)["”]\s*(?:[-—]\s*(.+))?$/);
  const quote = quoteMatch ? String(quoteMatch[1] || '').trim() : text;
  const author = quoteMatch && quoteMatch[2] ? String(quoteMatch[2] || '').trim() : 'Unknown';
  return buildQuotesMarkdown([{
    quote,
    author,
    savedAt: new Date().toISOString(),
    category: category || 'quote'
  }]);
};

function splitCompoundQuoteText(text, author, savedAt) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return [];

  const normalized = raw
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  const results = [];
  const seen = new Set();
  const pushEntry = (value, entryAuthor) => {
    const quote = String(value || '').trim().replace(/^[-–—:,\s]+/, '').replace(/[-–—:,\s]+$/, '');
    if (!quote) return;
    if (isBlockedQuoteEntry(quote)) return;
    if (/^(?:ted lasso quotes saved to quotes\.md|quotes saved to quotes\.md|saved quotes?)[:\s-]*$/i.test(quote)) return;
    const nextAuthor = String(entryAuthor || author || 'Unknown').trim() || 'Unknown';
    const key = normalizeQuoteKey(quote, nextAuthor);
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ quote, author: nextAuthor, savedAt: String(savedAt || '').trim() });
  };

  const extractDelimitedQuotes = (input) => {
    const extracted = [];
    let buffer = '';
    let inside = false;
    let delimiter = '';
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      const prev = i > 0 ? input[i - 1] : '';
      const next = i + 1 < input.length ? input[i + 1] : '';
      const prevIsWord = /[A-Za-z0-9]/.test(prev);
      const nextIsWord = /[A-Za-z0-9]/.test(next);
      const isApostrophe = ch === '\'' && prevIsWord && nextIsWord;
      if (!inside && (ch === '"' || (ch === '\'' && !isApostrophe))) {
        inside = true;
        delimiter = ch;
        buffer = '';
        continue;
      }
      if (inside && ch === delimiter) {
        if (delimiter === '\'' && nextIsWord) {
          buffer += ch;
          continue;
        }
        extracted.push(buffer.trim());
        inside = false;
        delimiter = '';
        buffer = '';
        continue;
      }
      if (inside) buffer += ch;
    }
    return extracted.filter(Boolean);
  };

  const quotedParts = extractDelimitedQuotes(normalized);
  quotedParts.forEach((part) => pushEntry(part, author));

  let remainder = normalized;
  quotedParts.forEach((part) => {
    const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    remainder = remainder.replace(new RegExp(`["']${escaped}["']`), ' ');
  });
  remainder = remainder.replace(/\s+/g, ' ').trim();
  remainder = remainder.replace(/^[^:]{0,120}quotes?\s+saved\s+to\s+quotes\.md[:\s-]*/i, '').trim();
  if (!quotedParts.length && /^[^:]{0,120}quotes?[:\s-]/i.test(remainder)) {
    remainder = remainder.replace(/^[^:]+:\s*/, '').trim();
  }
  const looksLikeQuoteList =
    quotedParts.length > 0 ||
    /quotes?\s+saved\s+to\s+quotes\.md/i.test(normalized) ||
    /^[^:]{0,120}quotes?[:\s-]/i.test(normalized) ||
    /\s+\|\s+/.test(remainder);
  if (looksLikeQuoteList) {
    remainder.split(/\s*,\s*|\s*;\s*|\s+\|\s+/).forEach((part) => {
      if (!part) return;
      pushEntry(part, author);
    });
  } else if (remainder) {
    pushEntry(remainder, author);
  }

  if (!results.length) {
    const singleMatch = normalized.match(/^"(.+?)"\s*(?:[-—–]\s*(.+))?$/);
    if (singleMatch) pushEntry(singleMatch[1], singleMatch[2] || author);
    else pushEntry(normalized, author);
  }
  return results;
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
    const quoteAuthor = authorMatch ? String(authorMatch[1] || '').trim() : 'Unknown';
    const quoteSavedAt = savedMatch ? String(savedMatch[1] || '').trim() : '';
    if (!quoteText) return;
    splitCompoundQuoteText(quoteText, quoteAuthor || 'Unknown', quoteSavedAt).forEach((entry) => entries.push(entry));
  });
  return entries;
}

function buildQuoteMarkdownFromMemory(memory, category) {
  const text = String(memory || '').trim();
  if (!text) return '';
  return buildQuotesMarkdown(
    splitCompoundQuoteText(text, 'Unknown', new Date().toISOString()).map((entry) => ({
      quote: entry.quote,
      author: entry.author,
      savedAt: entry.savedAt,
      category: category || 'quote'
    }))
  );
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.query && req.query.action === 'commit') return handleJoeyCommit(req, res);

  // Auth — accept admin hash OR any registered user
  const getPass = () => {
    if (req.method === 'GET') return req.query.passphrase;
    if (req.body && typeof req.body === 'object') return req.body.passphrase;
    return null;
  };
  const passphrase = getPass();
  if (!passphrase) return res.status(401).json({ error: 'Missing passphrase' });

  // Redis
  const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(500).json({ error: 'Redis not configured' });

  const redis = (cmd) => fetch(REDIS_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN },
    body: JSON.stringify(cmd)
  }).then(r => r.json());

  // Verify against admin hash or user database
  const ADMIN_HASH = (process.env.HOMER_ADMIN_HASH || '').trim();
  let isValid = ADMIN_HASH && passphrase.trim() === ADMIN_HASH;
  if (!isValid) {
    const usersData = await redis(['GET', 'homer:users']);
    const users = safeJsonParse(usersData && usersData.result, []);
    for (const user of users) {
      if (user && user.passwordHash === passphrase.trim()) { isValid = true; break; }
    }
  }
  if (!isValid) return res.status(403).json({ error: 'Forbidden' });

  const mode = getJoeyMode(req);
  const { MEMORY_KEY, HISTORY_KEY, PROFILE_KEY, FILES_KEY, FILE_LIBRARY_KEY, CUSTOM_FILES_KEY, JOURNAL_KEY, SYNC_META_KEY } = getJoeyContextKeys(mode);
  const MAX_MEMORIES = 320;
  const MAX_HISTORY = 100;
  const MAX_JOURNAL = 1800;

  async function loadJournal() {
    return loadRedisJson(redis, JOURNAL_KEY, []);
  }

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
    return {
      type,
      role: payload.role || '',
      text: String(payload.text || '').slice(0, 2000),
      category: payload.category || '',
      source: payload.source || 'system',
      ts: Number(payload.ts || Date.now()) || Date.now()
    };
  }

  function buildChatUrl(baseUrl) {
    const normalized = String(baseUrl || '').replace(/\/+$/, '');
    if (/\/openai\/v1$/i.test(normalized) || /\/v1$/i.test(normalized)) {
      return normalized + '/chat/completions';
    }
    return normalized + '/v1/chat/completions';
  }

  try {
    const { action } = req.query;

    // --- HISTORY ACTIONS ---
    if (action === 'history') {
      if (req.method === 'GET') {
        const result = await redis(['GET', HISTORY_KEY]);
        const history = result.result ? JSON.parse(result.result) : [];
        return res.status(200).json({ history });
      }
      if (req.method === 'POST') {
        const { messages } = req.body || {};
        if (!messages || !Array.isArray(messages)) {
          return res.status(400).json({ error: 'Missing messages array' });
        }
        const previous = await loadRedisJson(redis, HISTORY_KEY, []);
        const cleaned = messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role, content: (m.content || '').slice(0, 2000) }))
          .slice(-MAX_HISTORY);
        await redis(['SET', HISTORY_KEY, JSON.stringify(cleaned)]);
        const journalEntries = [];
        const prevNormalized = Array.isArray(previous) ? previous : [];
        const prevLooksPrefix = prevNormalized.length <= cleaned.length && prevNormalized.every((item, index) => (
          item && cleaned[index] &&
          item.role === cleaned[index].role &&
          String(item.content || '') === String(cleaned[index].content || '')
        ));
        if (prevLooksPrefix) {
          cleaned.slice(prevNormalized.length).forEach((item) => {
            journalEntries.push(buildJournalEntry('message', {
              role: item.role,
              text: item.content,
              source: 'history-sync'
            }));
          });
        } else {
          journalEntries.push(buildJournalEntry('history-rewrite', {
            text: JSON.stringify(cleaned.slice(-8)),
            source: 'history-sync'
          }));
        }
        await appendJournalEntries(journalEntries);
        return res.status(200).json({ ok: true, count: cleaned.length });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // --- MEMORY ACTIONS ---
    if (action === 'memory') {
      if (req.method === 'GET') {
        const result = await redis(['GET', MEMORY_KEY]);
        const memories = result.result ? JSON.parse(result.result) : [];
        return res.status(200).json({ memories });
      }
      if (req.method === 'POST') {
        const { memory, category, source, confidence, pinned } = req.body || {};
        if (!memory) return res.status(400).json({ error: 'Missing memory' });
        const [result, customFilesResult, filesResult] = await Promise.all([
          redis(['GET', MEMORY_KEY]),
          redis(['GET', CUSTOM_FILES_KEY]),
          redis(['GET', FILES_KEY])
        ]);
        const memories = result.result ? JSON.parse(result.result) : [];
        memories.push({
          id: Date.now(),
          text: memory,
          category: category || 'general',
          ts: Date.now(),
          source: source || 'manual',
          confidence: typeof confidence === 'number' ? Math.max(0, Math.min(1, confidence)) : undefined,
          pinned: !!pinned
        });
        while (memories.length > MAX_MEMORIES) memories.shift();
        const customFiles = sanitizeManagedCustomFiles(customFilesResult.result ? JSON.parse(customFilesResult.result) : {});
        const files = sanitizeManagedFiles(filesResult.result ? JSON.parse(filesResult.result) : {}, [], customFiles, new Date().toISOString());
        if (isQuoteLikeCategory(category)) {
          const nextQuoteContent = mergeQuotesMarkdown(customFiles[QUOTES_FILE_NAME], buildQuoteMarkdownFromMemory(memory, category));
          if (nextQuoteContent) {
            customFiles[QUOTES_FILE_NAME] = nextQuoteContent;
            files[QUOTES_FILE_NAME] = nextQuoteContent;
          }
        }
        await Promise.all([
          redis(['SET', MEMORY_KEY, JSON.stringify(memories)]),
          redis(['SET', CUSTOM_FILES_KEY, JSON.stringify(customFiles)]),
          redis(['SET', FILES_KEY, JSON.stringify(files)])
        ]);
        await appendJournalEntries([
          buildJournalEntry('memory-added', {
            text: memory,
            category: category || 'general',
            source: source || 'manual'
          })
        ]);
        return res.status(200).json({ ok: true, count: memories.length });
      }
      if (req.method === 'DELETE') {
        const { memoryId, match } = req.body || {};
        const result = await redis(['GET', MEMORY_KEY]);
        let memories = result.result ? JSON.parse(result.result) : [];
        if (memoryId) {
          memories = memories.filter(m => m.id !== memoryId);
        } else if (match) {
          const lower = match.toLowerCase();
          memories = memories.filter(m => !m.text.toLowerCase().includes(lower));
        } else {
          return res.status(400).json({ error: 'Missing memoryId or match' });
        }
        await redis(['SET', MEMORY_KEY, JSON.stringify(memories)]);
        await appendJournalEntries([
          buildJournalEntry('memory-removed', {
            text: String(match || memoryId || ''),
            source: 'manual'
          })
        ]);
        return res.status(200).json({ ok: true, count: memories.length });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // --- PROFILE ACTION ---
    if (action === 'profile') {
      if (req.method === 'GET') {
        const result = await redis(['GET', PROFILE_KEY]);
        const profile = result.result ? JSON.parse(result.result) : {};
        return res.status(200).json({ profile });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (action === 'bundle') {
      if (req.method === 'GET') {
        const [profileRes, memoryRes, historyRes, filesRes, libraryRes, customFilesRes, journalRes, syncMetaRes] = await Promise.all([
          redis(['GET', PROFILE_KEY]),
          redis(['GET', MEMORY_KEY]),
          redis(['GET', HISTORY_KEY]),
          redis(['GET', FILES_KEY]),
          redis(['GET', FILE_LIBRARY_KEY]),
          redis(['GET', CUSTOM_FILES_KEY]),
          redis(['GET', JOURNAL_KEY]),
          redis(['GET', SYNC_META_KEY])
        ]);
        const fileLibrary = libraryRes.result ? JSON.parse(libraryRes.result) : [];
        const customFiles = sanitizeManagedCustomFiles(customFilesRes.result ? JSON.parse(customFilesRes.result) : {});
        const bundle = {
          mode,
          exportedAt: Date.now(),
          profile: profileRes.result ? JSON.parse(profileRes.result) : {},
          memories: memoryRes.result ? JSON.parse(memoryRes.result) : [],
          history: historyRes.result ? JSON.parse(historyRes.result) : [],
          files: sanitizeManagedFiles(filesRes.result ? JSON.parse(filesRes.result) : {}, fileLibrary, customFiles, new Date().toISOString()),
          fileLibrary: fileLibrary,
          customFiles: customFiles,
          journal: journalRes.result ? JSON.parse(journalRes.result) : []
        };
        const storedSyncMeta = syncMetaRes.result ? JSON.parse(syncMetaRes.result) : null;
        bundle.syncMeta = storedSyncMeta && typeof storedSyncMeta === 'object'
          ? storedSyncMeta
          : computeJoeySyncMeta(bundle, { mode, lastSource: 'bundle-export' });
        return res.status(200).json({
          ok: true,
          bundle
        });
      }
      if (req.method === 'POST') {
        const bundle = req.body && req.body.bundle;
        if (!bundle || typeof bundle !== 'object') {
          return res.status(400).json({ error: 'Missing bundle' });
        }
        if (bundle.mode && String(bundle.mode).trim() && String(bundle.mode).trim() !== mode) {
          return res.status(409).json({ error: 'Bundle mode mismatch', expectedMode: mode, bundleMode: String(bundle.mode).trim() });
        }
        const profile = bundle.profile && typeof bundle.profile === 'object' ? bundle.profile : {};
        const memories = Array.isArray(bundle.memories) ? bundle.memories : [];
        const history = Array.isArray(bundle.history) ? bundle.history : [];
        const fileLibrary = Array.isArray(bundle.fileLibrary) ? bundle.fileLibrary : [];
        const customFiles = sanitizeManagedCustomFiles(bundle.customFiles);
        const files = sanitizeManagedFiles(bundle.files, fileLibrary, customFiles, new Date().toISOString());
        const journal = Array.isArray(bundle.journal) ? bundle.journal : [];
        const syncMeta = bundle.syncMeta && typeof bundle.syncMeta === 'object'
          ? bundle.syncMeta
          : computeJoeySyncMeta({ mode, profile, memories, history, files, fileLibrary, customFiles, journal }, { mode, lastSource: 'bundle-restore' });

        await Promise.all([
          redis(['SET', PROFILE_KEY, JSON.stringify(profile)]),
          redis(['SET', MEMORY_KEY, JSON.stringify(memories.slice(-MAX_MEMORIES))]),
          redis(['SET', HISTORY_KEY, JSON.stringify(history.filter(m => m && (m.role === 'user' || m.role === 'assistant')).slice(-MAX_HISTORY))]),
          redis(['SET', FILES_KEY, JSON.stringify(files)]),
          redis(['SET', FILE_LIBRARY_KEY, JSON.stringify(fileLibrary)]),
          redis(['SET', CUSTOM_FILES_KEY, JSON.stringify(customFiles)]),
          redis(['SET', JOURNAL_KEY, JSON.stringify(journal.slice(-MAX_JOURNAL))]),
          redis(['SET', SYNC_META_KEY, JSON.stringify(syncMeta)])
        ]);
        return res.status(200).json({
          ok: true,
          restored: {
            mode,
            memories: memories.length,
            history: history.length,
            fileLibrary: fileLibrary.length,
            customFiles: Object.keys(customFiles).length,
            journal: journal.length
          }
        });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (action === 'sync-meta') {
      if (req.method === 'GET') {
        const [profileRes, memoryRes, historyRes, filesRes, libraryRes, customFilesRes, journalRes, syncMetaRes] = await Promise.all([
          redis(['GET', PROFILE_KEY]),
          redis(['GET', MEMORY_KEY]),
          redis(['GET', HISTORY_KEY]),
          redis(['GET', FILES_KEY]),
          redis(['GET', FILE_LIBRARY_KEY]),
          redis(['GET', CUSTOM_FILES_KEY]),
          redis(['GET', JOURNAL_KEY]),
          redis(['GET', SYNC_META_KEY])
        ]);
        const bundle = {
          mode,
          profile: profileRes.result ? JSON.parse(profileRes.result) : {},
          memories: memoryRes.result ? JSON.parse(memoryRes.result) : [],
          history: historyRes.result ? JSON.parse(historyRes.result) : [],
          files: sanitizeManagedFiles(filesRes.result ? JSON.parse(filesRes.result) : {}, libraryRes.result ? JSON.parse(libraryRes.result) : [], customFilesRes.result ? JSON.parse(customFilesRes.result) : {}, new Date().toISOString()),
          fileLibrary: libraryRes.result ? JSON.parse(libraryRes.result) : [],
          customFiles: sanitizeManagedCustomFiles(customFilesRes.result ? JSON.parse(customFilesRes.result) : {}),
          journal: journalRes.result ? JSON.parse(journalRes.result) : []
        };
        const storedSyncMeta = syncMetaRes.result ? JSON.parse(syncMetaRes.result) : {};
        const syncMeta = computeJoeySyncMeta(bundle, {
          ...storedSyncMeta,
          mode,
          updatedAt: new Date().toISOString()
        });
        return res.status(200).json({ ok: true, syncMeta });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (action === 'journal') {
      if (req.method === 'GET') {
        const journal = await loadJournal();
        return res.status(200).json({ ok: true, journal });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (action === 'files') {
      if (req.method === 'GET') {
        const [result, libraryResult, customResult] = await Promise.all([
          redis(['GET', FILES_KEY]),
          redis(['GET', FILE_LIBRARY_KEY]),
          redis(['GET', CUSTOM_FILES_KEY])
        ]);
        const fileLibrary = libraryResult.result ? JSON.parse(libraryResult.result) : [];
        const customFiles = sanitizeManagedCustomFiles(customResult.result ? JSON.parse(customResult.result) : {});
        const files = sanitizeManagedFiles(result.result ? JSON.parse(result.result) : {}, fileLibrary, customFiles, new Date().toISOString());
        await Promise.all([
          redis(['SET', CUSTOM_FILES_KEY, JSON.stringify(customFiles)]),
          redis(['SET', FILES_KEY, JSON.stringify(files)])
        ]);
        return res.status(200).json({ files });
      }
      if (req.method === 'POST') {
        const { tasks } = req.body || {};
        const effectiveTasks = mode === 'work' ? [] : (Array.isArray(tasks) ? tasks : []);
        const [memRes, profileRes, histRes, filesRes, libraryRes, customFilesRes, syncMetaRes] = await Promise.all([
          redis(['GET', MEMORY_KEY]),
          redis(['GET', PROFILE_KEY]),
          redis(['GET', HISTORY_KEY]),
          redis(['GET', FILES_KEY]),
          redis(['GET', FILE_LIBRARY_KEY]),
          redis(['GET', CUSTOM_FILES_KEY]),
          redis(['GET', SYNC_META_KEY])
        ]);
        const existingCustomFiles = sanitizeManagedCustomFiles(customFilesRes.result ? JSON.parse(customFilesRes.result) : {});
        const existingFiles = sanitizeManagedFiles(filesRes.result ? JSON.parse(filesRes.result) : {}, libraryRes.result ? JSON.parse(libraryRes.result) : [], existingCustomFiles, new Date().toISOString());
        const currentSyncMeta = syncMetaRes.result ? JSON.parse(syncMetaRes.result) : {};
        const generatedAt = String((currentSyncMeta && (currentSyncMeta.lastCommittedAt || currentSyncMeta.updatedAt)) || new Date().toISOString());
        const generatedFiles = buildContextFiles({
          profile: profileRes.result ? JSON.parse(profileRes.result) : {},
          memories: memRes.result ? JSON.parse(memRes.result) : [],
          history: histRes.result ? JSON.parse(histRes.result) : [],
          tasks: effectiveTasks,
          fileLibrary: libraryRes.result ? JSON.parse(libraryRes.result) : [],
          customFiles: existingCustomFiles,
          scope: mode,
          generatedAt
        });
        const preserved = preserveGeneratedContextFiles(existingFiles, generatedFiles, existingCustomFiles, new Date().toISOString());
        await Promise.all([
          redis(['SET', FILES_KEY, JSON.stringify(preserved.files)]),
          redis(['SET', CUSTOM_FILES_KEY, JSON.stringify(preserved.customFiles)])
        ]);
        return res.status(200).json({ ok: true, files: preserved.files, preserved: Object.keys(preserved.customFiles).length - Object.keys(existingCustomFiles || {}).length });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (action === 'file-library') {
      if (req.method === 'GET') {
        const result = await redis(['GET', FILE_LIBRARY_KEY]);
        const files = result.result ? JSON.parse(result.result) : [];
        return res.status(200).json({ files });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // --- CUSTOM FILES CRUD ---
    if (action === 'custom-files') {
      if (req.method === 'GET') {
        const result = await redis(['GET', CUSTOM_FILES_KEY]);
        const customFiles = sanitizeManagedCustomFiles(result.result ? JSON.parse(result.result) : {});
        await redis(['SET', CUSTOM_FILES_KEY, JSON.stringify(customFiles)]);
        return res.status(200).json({ customFiles });
      }
      if (req.method === 'POST') {
        const { name, content, replace } = req.body || {};
        if (!name || typeof content !== 'string') return res.status(400).json({ error: 'Missing name or content' });
        const safeName = String(name).trim().replace(/\.\./g, '').replace(/^\/+/, '').slice(0, 200);
        if (!safeName) return res.status(400).json({ error: 'Invalid file name' });
        const [result, filesResult] = await Promise.all([
          redis(['GET', CUSTOM_FILES_KEY]),
          redis(['GET', FILES_KEY])
        ]);
        const customFiles = sanitizeManagedCustomFiles(result.result ? JSON.parse(result.result) : {});
        const files = sanitizeManagedFiles(filesResult.result ? JSON.parse(filesResult.result) : {}, [], customFiles, new Date().toISOString());
        if (!content.trim()) {
          delete customFiles[safeName];
          delete files[safeName];
        } else {
          const nextContent = safeName === QUOTES_FILE_NAME
            ? (replace ? mergeQuotesMarkdown('', content) : mergeQuotesMarkdown(customFiles[safeName], content))
            : content.trim().slice(0, 50000);
          customFiles[safeName] = nextContent;
          files[safeName] = customFiles[safeName];
        }
        await Promise.all([
          redis(['SET', CUSTOM_FILES_KEY, JSON.stringify(customFiles)]),
          redis(['SET', FILES_KEY, JSON.stringify(files)])
        ]);
        return res.status(200).json({ ok: true, name: safeName, count: Object.keys(customFiles).length });
      }
      if (req.method === 'DELETE') {
        const { name } = req.body || {};
        if (!name) return res.status(400).json({ error: 'Missing name' });
        const [result, filesResult] = await Promise.all([
          redis(['GET', CUSTOM_FILES_KEY]),
          redis(['GET', FILES_KEY])
        ]);
        const customFiles = sanitizeManagedCustomFiles(result.result ? JSON.parse(result.result) : {});
        const files = sanitizeManagedFiles(filesResult.result ? JSON.parse(filesResult.result) : {}, [], customFiles, new Date().toISOString());
        delete customFiles[String(name).trim()];
        delete files[String(name).trim()];
        await Promise.all([
          redis(['SET', CUSTOM_FILES_KEY, JSON.stringify(customFiles)]),
          redis(['SET', FILES_KEY, JSON.stringify(files)])
        ]);
        return res.status(200).json({ ok: true, count: Object.keys(customFiles).length });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // --- LEARN ACTION (POST only) ---
    if (action === 'learn' && req.method === 'POST') {
      const { messages } = req.body || {};
      if (!messages || !Array.isArray(messages) || messages.length < 2) {
        return res.status(400).json({ error: 'Need at least 2 messages' });
      }

      const cleanedMessages = messages
        .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
        .map((item) => ({ role: item.role, content: String(item.content || '').slice(0, 2000) }))
        .slice(-MAX_HISTORY);

      const learnOutcome = await runLearnStep({
        mode,
        messages: cleanedMessages,
        redisFetch: redis,
        keys: { MEMORY_KEY, PROFILE_KEY }
      });

      if (learnOutcome && learnOutcome.ok && Array.isArray(learnOutcome.facts) && learnOutcome.facts.length) {
        await appendJournalEntries(learnOutcome.facts.map((fact) => (
          buildJournalEntry('memory-learned', {
            text: fact,
            source: 'auto-learn'
          })
        )));
      }

      const [currentProfile, currentMemories, currentHistory, currentFiles, currentFileLibrary, currentCustomFiles, currentJournal, currentSyncMeta] = await Promise.all([
        loadRedisJson(redis, PROFILE_KEY, {}),
        loadRedisJson(redis, MEMORY_KEY, []),
        loadRedisJson(redis, HISTORY_KEY, []),
        loadRedisJson(redis, FILES_KEY, {}),
        loadRedisJson(redis, FILE_LIBRARY_KEY, []),
        loadRedisJson(redis, CUSTOM_FILES_KEY, {}),
        loadRedisJson(redis, JOURNAL_KEY, []),
        loadRedisJson(redis, SYNC_META_KEY, {})
      ]);

      const learnedAt = new Date().toISOString();
      const rebuiltFiles = preserveGeneratedContextFiles(
        currentFiles,
        buildContextFiles({
          profile: currentProfile,
          memories: currentMemories,
          history: currentHistory,
          tasks: [],
          fileLibrary: currentFileLibrary,
          customFiles: currentCustomFiles,
          scope: mode,
          generatedAt: learnedAt
        }),
        currentCustomFiles,
        learnedAt
      ).files;
      await saveRedisJson(redis, FILES_KEY, rebuiltFiles);

      const nextSyncMeta = computeJoeySyncMeta({
        mode,
        profile: currentProfile,
        memories: currentMemories,
        history: currentHistory,
        files: rebuiltFiles,
        fileLibrary: currentFileLibrary,
        customFiles: currentCustomFiles,
        journal: currentJournal
      }, {
        mode,
        updatedAt: learnedAt,
        lastCommittedAt: currentSyncMeta && currentSyncMeta.lastCommittedAt ? currentSyncMeta.lastCommittedAt : null,
        lastDriveBackupAt: currentSyncMeta && currentSyncMeta.lastDriveBackupAt ? currentSyncMeta.lastDriveBackupAt : null,
        lastDriveReconcileAt: currentSyncMeta && currentSyncMeta.lastDriveReconcileAt ? currentSyncMeta.lastDriveReconcileAt : null,
        driveExportedAt: currentSyncMeta && currentSyncMeta.driveExportedAt ? currentSyncMeta.driveExportedAt : null,
        lastSource: 'learn'
      });
      await saveRedisJson(redis, SYNC_META_KEY, nextSyncMeta);

      return res.status(200).json({
        ...learnOutcome,
        syncMetaUpdated: true,
        filesUpdated: true,
        totalJournalEntries: Array.isArray(currentJournal) ? currentJournal.length : 0
      });

      const GATEWAY_URL = String(process.env.OC_GATEWAY_URL || 'https://api.kilo.ai/api/gateway').trim().replace(/\/+$/, '');
      const GATEWAY_TOKEN = String(process.env.OC_GATEWAY_TOKEN || '').trim();
      const MODEL = String(process.env.OC_MODEL || 'xiaomi/mimo-v2-pro:free').trim();

      function llmCall(msgs, maxTokens) {
        const headers = { 'Content-Type': 'application/json' };
        if (GATEWAY_TOKEN) headers['Authorization'] = 'Bearer ' + GATEWAY_TOKEN;
        return fetch(buildChatUrl(GATEWAY_URL), {
          method: 'POST',
          headers,
          body: JSON.stringify({ model: MODEL, messages: msgs, temperature: 0.1, max_tokens: maxTokens || 800 })
        }).then(r => r.json());
      }

      function parseLLMJson(raw) {
        let cleaned = (raw || '').trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        }
        try {
          return JSON.parse(cleaned);
        } catch (err) {
          const start = cleaned.indexOf('{');
          if (start === -1) throw err;
          let depth = 0;
          let inString = false;
          let escape = false;
          for (let i = start; i < cleaned.length; i++) {
            const ch = cleaned[i];
            if (inString) {
              if (escape) {
                escape = false;
              } else if (ch === '\\') {
                escape = true;
              } else if (ch === '"') {
                inString = false;
              }
              continue;
            }
            if (ch === '"') {
              inString = true;
              continue;
            }
            if (ch === '{') depth++;
            if (ch === '}') {
              depth--;
              if (depth === 0) {
                return JSON.parse(cleaned.slice(start, i + 1));
              }
            }
          }
          throw err;
        }
      }

      function similarity(a, b) {
        const wordsA = new Set(a.split(/\s+/));
        const wordsB = new Set(b.split(/\s+/));
        let intersection = 0;
        for (const w of wordsA) { if (wordsB.has(w)) intersection++; }
        const union = wordsA.size + wordsB.size - intersection;
        return union === 0 ? 0 : intersection / union;
      }

      const [memResult, profileResult] = await Promise.all([
        redis(['GET', MEMORY_KEY]),
        redis(['GET', PROFILE_KEY])
      ]);

      const existing = memResult.result ? JSON.parse(memResult.result) : [];
      const profile = profileResult.result ? JSON.parse(profileResult.result) : {};

      const existingText = existing.length ? existing.map(m => '- [' + m.category + '] ' + m.text).join('\n') : '(none yet)';
      const profileText = Object.keys(profile).length ? JSON.stringify(profile, null, 1) : '(empty)';

      const extractPrompt = mode === 'work'
        ? `You are a work memory and operations system. Analyze this conversation and do TWO things:

1. EXTRACT NEW WORKING MEMORY - tasks, commitments, blockers, deadlines, stakeholders, decisions, and reusable work notes worth remembering
2. UPDATE WORK PROFILE - maintain a practical profile of current projects, responsibilities, collaborators, and working style

EXISTING MEMORIES (do NOT duplicate):
${existingText}

CURRENT PROFILE:
${profileText}

WORK MEMORY RULES:
- Only extract facts NOT already in existing memories
- Bias strongly toward work recall: responsibilities, deadlines, owners, blockers, follow-ups, meeting outcomes, commitments, processes, and project context
- Categories: work, decision, resource, fact, person, goal, routine, lesson, win, pin, archive
- Each memory = one concise standalone fact
- Prefer "decision" for choices, defaults, approvals, policies, or "we decided..."
- Prefer "resource" for docs, links, procedures, commands, templates, and reusable notes
- Prefer "work" for open responsibilities, recurring obligations, project facts, clients, systems, and status context
- Prefer "pin" for always-important work context that should stay front-and-center
- Prefer "lesson" for misses, blockers, and what they imply for future work
- Prefer "win" for shipped work, praise, progress, and breakthroughs
- Capture exact dates, deadlines, and stakeholders when mentioned
- Do not save generic chit-chat or non-actionable filler

WORK PROFILE RULES:
- Update fields that changed, add new ones, keep existing ones
- Track: profession, communication_style, people, active_goals, recent_topics, current_mood, timezone, projects, responsibilities, stakeholders, routines, important_dates
- Keep it operational and concise

Return ONLY this JSON:
{
  "memories": [{"text": "fact", "category": "category", "source": "auto-learn", "confidence": 0.0-1.0}],
  "profile": { ...full updated profile object... }
}`
        : `You are a personal memory & profile system. Analyze this conversation and do TWO things:

1. EXTRACT NEW MEMORIES — facts about the user worth remembering permanently
2. UPDATE USER PROFILE — maintain a living profile of who this person is

EXISTING MEMORIES (do NOT duplicate):
${existingText}

CURRENT PROFILE:
${profileText}

MEMORY RULES:
- Only extract facts NOT already in existing memories
- Categories: preference, fact, person, event, lesson, win, goal, habit, opinion, routine, health, work, resource, decision, pin, archive
- Each memory = one concise standalone fact
- Capture EMOTIONAL context too
- Use category "win" for achievements, proud moments, things that went really well, breakthroughs, compliments, progress, or anything the user feels good about.
- Use category "lesson" for painful mistakes, setbacks, bad experiences, regrets, failures, hard realizations, or anything the user explicitly says taught them something.
- Use category "resource" for reusable notes, references, research, frameworks, links, or useful information the user will likely want later.
- Use category "decision" for explicit choices, commitments, defaults, policies, or "we decided to..." statements.
- Use category "pin" only for always-important context that should stay front-and-center for future turns.
- Prefer "win" or "lesson" over generic "event" whenever the conversation clearly frames the experience that way.
- If the user says things like "I'm proud", "this went well", "I nailed it", "I learned", "this taught me", "I won't do that again", or similar, strongly prefer saving a memory in the matching category.

PROFILE RULES:
- Update fields that changed, add new ones, keep existing ones
- Track: name, nickname, location, timezone, profession, interests, communication_style, current_mood, people, active_goals, recent_topics, languages, important_dates

Return ONLY this JSON:
{
  "memories": [{"text": "fact", "category": "category", "source": "auto-learn", "confidence": 0.0-1.0}],
  "profile": { ...full updated profile object... }
}`;

      const recentMsgs = messages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-8);
      const llmData = await llmCall([
        { role: 'system', content: extractPrompt },
        ...recentMsgs,
        { role: 'user', content: 'Extract memories and update profile. Return JSON only.' }
      ], 1200);

      const rawContent = (llmData.choices && llmData.choices[0] && llmData.choices[0].message && llmData.choices[0].message.content) || '{}';

      let result;
      try { result = parseLLMJson(rawContent); } catch (e) {
        return res.status(200).json({ ok: true, learned: 0, profileUpdated: false, reason: 'Unparseable response' });
      }

      const newFacts = Array.isArray(result.memories) ? result.memories : [];
      const updatedProfile = result.profile && typeof result.profile === 'object' ? result.profile : profile;

      updatedProfile._lastUpdated = new Date().toISOString();
      await redis(['SET', PROFILE_KEY, JSON.stringify(updatedProfile)]);

      const existingLower = existing.map(m => m.text.toLowerCase());
      const genuinelyNew = newFacts.filter(f => {
        if (!f.text || typeof f.text !== 'string' || f.text.length < 5) return false;
        const lower = f.text.toLowerCase();
        return !existingLower.some(e => e.includes(lower) || lower.includes(e) || similarity(e, lower) > 0.85);
      });

      let updated = [...existing];
      for (const fact of genuinelyNew) {
        const confidence = typeof fact.confidence === 'number' ? Math.max(0, Math.min(1, fact.confidence)) : 0.72;
        updated.push({
          id: Date.now() + Math.random(),
          text: fact.text.slice(0, 500),
          category: fact.category || 'general',
          ts: Date.now(),
          auto: true,
          source: fact.source || 'auto-learn',
          confidence,
          pinned: (fact.category || '').toLowerCase() === 'pin'
        });
      }

      // Consolidate if too many
      if (updated.length > 150) {
        updated.sort((a, b) => (a.ts || 0) - (b.ts || 0));
        const toKeep = updated.slice(-100);
        const toConsolidate = updated.slice(0, -100);
        if (toConsolidate.length >= 10) {
          const groups = {};
          for (const m of toConsolidate) {
            const cat = m.category || 'general';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(m.text);
          }
          const summaries = [];
          for (const [cat, texts] of Object.entries(groups)) {
            const unique = [...new Set(texts)];
            summaries.push({ id: Date.now() + Math.random(), text: '[CONSOLIDATED] ' + unique.join(' | '), category: cat, ts: Date.now(), consolidated: true, sourceCount: unique.length });
          }
          updated = [...summaries, ...toKeep];
        }
      }

      while (updated.length > MAX_MEMORIES) updated.shift();
      await redis(['SET', MEMORY_KEY, JSON.stringify(updated)]);

      return res.status(200).json({ ok: true, learned: genuinelyNew.length, facts: genuinelyNew.map(f => f.text), profileUpdated: true, totalMemories: updated.length });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

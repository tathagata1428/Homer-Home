import { selectContextFiles } from './context-selection.js';
import { getJoeyContextKeys, getJoeyMode, getJoeyModeLabel } from './joey-context.js';
import { extractDeterministicMemories, mergeHistoryMessages } from './joey-commit-handler.js';
import { createRedisFetch, getRedisConfig, loadRedisJson, verifyJoeyPassphrase } from './joey-server.js';
import { isSupabaseConfigured, createAdminClient } from './supabase-server.js';
import { createSupabaseRedisFetch } from './supabase-redis-compat.js';

const MAX_HISTORY = 100;
const MAX_MEMORIES = 320;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeHistoryMessage(item, index) {
  if (!item || (item.role !== 'user' && item.role !== 'assistant')) return null;
  const content = String(item.content || '').slice(0, 2000);
  if (!content.trim()) return null;
  const rawTs = Number(item.ts);
  return {
    role: item.role,
    content,
    ts: Number.isFinite(rawTs) && rawTs > 0 ? rawTs : (Date.now() + index)
  };
}

function sameHistoryMessage(a, b) {
  return !!a && !!b &&
    a.role === b.role &&
    String(a.content || '') === String(b.content || '') &&
    Number(a.ts || 0) === Number(b.ts || 0);
}

function uniqueMemoryFacts(existing, incoming) {
  const current = asArray(existing);
  const next = [];
  const seen = new Set(current.map((item) => String(item && item.text || '').trim().toLowerCase()).filter(Boolean));
  asArray(incoming).forEach((fact) => {
    if (!fact || typeof fact.text !== 'string') return;
    const text = String(fact.text || '').trim();
    if (text.length < 3) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    next.push({
      id: Date.now() + Math.random(),
      text: text.slice(0, 500),
      category: fact.category || 'fact',
      ts: Date.now(),
      auto: true,
      source: fact.source || 'deterministic-learn',
      confidence: typeof fact.confidence === 'number' ? Math.max(0, Math.min(1, fact.confidence)) : 0.99,
      pinned: !!fact.pinned || String(fact.category || '').toLowerCase() === 'pin'
    });
  });
  return current.concat(next).slice(-MAX_MEMORIES);
}

async function saveRedisJson(redisFetch, key, value) {
  const response = await redisFetch(['SET', key, JSON.stringify(value == null ? null : value)]);
  return response && response.error ? Promise.reject(new Error(response.error)) : true;
}

async function primeSharedStateFromIncomingTurn(redisFetch, keys, mode, messages, options = {}) {
  const incomingMessages = asArray(messages)
    .map(normalizeHistoryMessage)
    .filter(Boolean)
    .slice(-MAX_HISTORY);
  const clearedAt = Number(options.chatClearedAt || 0);
  const updatedAt = new Date().toISOString();
  const deviceId = String(options.deviceId || '').trim().slice(0, 120);
  const deviceLabel = String(options.deviceLabel || '').trim().slice(0, 160);

  const [previousHistory, profile, memories, storedSyncMeta] = await Promise.all([
    loadRedisJson(redisFetch, keys.HISTORY_KEY, []),
    loadRedisJson(redisFetch, keys.PROFILE_KEY, {}),
    loadRedisJson(redisFetch, keys.MEMORY_KEY, []),
    loadRedisJson(redisFetch, keys.SYNC_META_KEY, {})
  ]);

  const mergedHistory = mergeHistoryMessages(previousHistory, incomingMessages, { clearedAt });
  const deterministic = extractDeterministicMemories(mergedHistory.slice(-8), mode, profile);
  const profilePatch = asObject(deterministic.profile);
  const mergedProfile = {
    ...asObject(profile),
    ...profilePatch
  };
  const nextMemories = uniqueMemoryFacts(memories, deterministic.memories);
  const profileChanged = JSON.stringify(asObject(profile)) !== JSON.stringify(mergedProfile);
  const nextProfile = profileChanged ? { ...mergedProfile, _lastUpdated: updatedAt } : asObject(profile);
  const memoriesChanged = JSON.stringify(asArray(memories)) !== JSON.stringify(nextMemories);
  const historyChanged = JSON.stringify(asArray(previousHistory)) !== JSON.stringify(mergedHistory);
  const priorSyncMeta = storedSyncMeta && typeof storedSyncMeta === 'object' ? storedSyncMeta : {};
  const syncMeta = {
    ...priorSyncMeta,
    mode,
    updatedAt,
    lastCommittedAt: updatedAt,
    lastSource: 'chat-turn',
    lastDeviceId: deviceId || priorSyncMeta.lastDeviceId || '',
    lastDeviceLabel: deviceLabel || priorSyncMeta.lastDeviceLabel || '',
    lastDeviceSyncedAt: updatedAt,
    counts: {
      ...(priorSyncMeta.counts && typeof priorSyncMeta.counts === 'object' ? priorSyncMeta.counts : {}),
      memories: nextMemories.length,
      history: mergedHistory.length
    }
  };

  const writes = [
    saveRedisJson(redisFetch, keys.HISTORY_KEY, mergedHistory),
    saveRedisJson(redisFetch, keys.SYNC_META_KEY, syncMeta)
  ];
  if (profileChanged) writes.push(saveRedisJson(redisFetch, keys.PROFILE_KEY, nextProfile));
  if (memoriesChanged) writes.push(saveRedisJson(redisFetch, keys.MEMORY_KEY, nextMemories));
  await Promise.all(writes);

  return {
    profile: nextProfile,
    memories: nextMemories,
    history: mergedHistory,
    syncMeta
  };
}

function buildQuotesFileFromSavedContent(markdown) {
  const value = String(markdown || '').replace(/\r\n/g, '\n').trim();
  if (!value) return '';
  return value.endsWith('\n') ? value : (value + '\n');
}

function sanitizeUserQuery(raw) {
  return String(raw || '')
    .replace(/\[Attached files for analysis\][\s\S]*?--- end ---\n*/g, '')
    .replace(/\[(FORCE_WEB_SEARCH|USE_FULL_CONTEXT|DEEP_CONTEXT)\]\s*/gi, '')
    .replace(/^(search for|search|look up|find)\s*:?\s*/i, '')
    .trim()
    .slice(0, 240);
}

function isWebSearchIntent(query) {
  if (!query || query.length < 8) return false;
  return /\b(search|find|look up|what('s| is| are| was| were)?|who('?s| is| was)?|when|where|how|latest|news|events?|weather|price|stock|market|score|results?|happening|schedule|review|recommend|best|top \d|near me|today|tonight|tomorrow|this week|upcoming|current|recent|update|updates|2025|2026)\b/i.test(query);
}

function buildChatUrl(baseUrl) {
  const normalized = String(baseUrl || '').replace(/\/+$/, '');
  if (/\/openai\/v1$/i.test(normalized) || /\/v1$/i.test(normalized)) {
    return normalized + '/chat/completions';
  }
  return normalized + '/v1/chat/completions';
}

function clampText(text, maxChars) {
  const value = String(text || '').trim();
  if (!value || value.length <= maxChars) return value;
  return value.slice(0, maxChars) + '\n...[truncated]';
}

function sameMessage(a, b) {
  return !!a && !!b && a.role === b.role && String(a.content || '') === String(b.content || '');
}

function getBackfillMessages(history, current, limit) {
  if (!Array.isArray(history) || !history.length) return [];
  if (!Array.isArray(current) || !current.length) return history.slice(-limit);

  let overlap = 0;
  const maxOverlap = Math.min(history.length, current.length);
  while (overlap < maxOverlap) {
    const histMsg = history[history.length - 1 - overlap];
    const currentMsg = current[current.length - 1 - overlap];
    if (!sameMessage(histMsg, currentMsg)) break;
    overlap += 1;
  }

  const trimmedHistory = overlap ? history.slice(0, history.length - overlap) : history;
  return trimmedHistory.slice(-limit);
}

function buildProfileText(profile) {
  if (!profile || typeof profile !== 'object') return '';

  const fields = [];
  const identity = [];
  if (profile.name) fields.push('Name: ' + profile.name);
  if (profile.nickname) fields.push('Preferred name: ' + profile.nickname);
  if (profile.location) fields.push('Location: ' + profile.location);
  if (profile.timezone) fields.push('Timezone: ' + profile.timezone);
  if (profile.profession) fields.push('Profession: ' + profile.profession);
  if (profile.communication_style) fields.push('Communication style: ' + profile.communication_style);
  if (profile.current_mood) fields.push('Recent mood: ' + profile.current_mood);
  if (profile.languages) fields.push('Languages: ' + (Array.isArray(profile.languages) ? profile.languages.join(', ') : profile.languages));
  if (profile.interests) fields.push('Interests: ' + (Array.isArray(profile.interests) ? profile.interests.join(', ') : profile.interests));

  if (profile.people && typeof profile.people === 'object') {
    const people = Array.isArray(profile.people)
      ? profile.people.map((person) => (person.name || person) + (person.relationship ? ' (' + person.relationship + ')' : ''))
      : Object.entries(profile.people).map(([name, relationship]) => name + ' (' + relationship + ')');
    if (people.length) fields.push('People: ' + people.join(', '));
  }

  if (Array.isArray(profile.active_goals) && profile.active_goals.length) {
    fields.push('Active goals: ' + profile.active_goals.join(', '));
  }

  if (Array.isArray(profile.recent_topics) && profile.recent_topics.length) {
    fields.push('Recent topics: ' + profile.recent_topics.slice(-5).join(', '));
  }

  if (profile.important_dates && typeof profile.important_dates === 'object') {
    const dates = Array.isArray(profile.important_dates)
      ? profile.important_dates.map((entry) => (entry.label || entry.event || '') + ': ' + (entry.date || ''))
      : Object.entries(profile.important_dates).map(([label, date]) => label + ': ' + date);
    if (dates.length) fields.push('Important dates: ' + dates.join(', '));
  }

  if (profile.name || profile.nickname) identity.push((profile.nickname || profile.name) + ' is the user you are serving.');
  if (profile.profession) identity.push('Primary role: ' + profile.profession);
  if (Array.isArray(profile.active_goals) && profile.active_goals.length) identity.push('Current priorities: ' + profile.active_goals.slice(-5).join(', '));
  if (profile.communication_style) identity.push('Preferred communication style: ' + profile.communication_style);
  if (profile.working_style) identity.push('Working style: ' + profile.working_style);
  if (profile.preferences) identity.push('Known preferences: ' + (Array.isArray(profile.preferences) ? profile.preferences.join(', ') : profile.preferences));
  if (profile.favorite_color) identity.push('Favorite color: ' + profile.favorite_color);
  if (profile.temperature_unit) identity.push('Preferred temperature unit: ' + profile.temperature_unit);
  if (profile.recurring_stressors) identity.push('Recurring stressors to account for: ' + (Array.isArray(profile.recurring_stressors) ? profile.recurring_stressors.join(', ') : profile.recurring_stressors));
  if (profile.motivators) identity.push('Motivators: ' + (Array.isArray(profile.motivators) ? profile.motivators.join(', ') : profile.motivators));

  const sections = [];
  if (identity.length) sections.push('=== USER IDENTITY ANCHORS ===\n' + identity.join('\n'));
  if (fields.length) sections.push('=== WHO YOU ARE TALKING TO ===\n' + fields.join('\n'));
  return sections.length ? '\n\n' + sections.join('\n\n') : '';
}

function tokenizeMemoryQuery(text) {
  return Array.from(new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token && token.length > 2 && !/^(what|when|where|which|would|could|should|about|tell|with|from|that|this|your|have|been|into|them|they|then|than|were|does|did|please|remember|save|keep|mind)$/i.test(token))
  ));
}

function buildMemoriesText(memories, userQuery) {
  if (!Array.isArray(memories) || !memories.length) return '';

  const categoryOrder = ['pin', 'preference', 'habit', 'routine', 'person', 'goal', 'decision', 'win', 'lesson', 'work', 'fact', 'resource', 'health', 'event', 'opinion', 'archive', 'general'];
  const groups = new Map();
  const sorted = [...memories].sort((a, b) => {
    const aTs = Number(a && a.ts) || 0;
    const bTs = Number(b && b.ts) || 0;
    return aTs - bTs;
  });
  sorted.forEach((memory) => {
    const category = String((memory && memory.category) || 'general').toLowerCase();
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(memory);
  });

  const lines = [];
  const queryTokens = tokenizeMemoryQuery(userQuery);
  const relevantMemories = queryTokens.length
    ? sorted
      .map((memory) => {
        const text = String(memory && memory.text || '').trim();
        const haystack = text.toLowerCase();
        let score = 0;
        queryTokens.forEach((token) => {
          if (haystack.includes(token)) score += 4;
        });
        if (memory && memory.pinned) score += 3;
        if (/^(direct-user-remember|implicit-profile-remember)$/i.test(String(memory && memory.source || ''))) score += 2;
        score += Math.min(2, (Number(memory && memory.ts) || 0) / 1e13);
        return { memory, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || (Number(b.memory && b.memory.ts) || 0) - (Number(a.memory && a.memory.ts) || 0))
      .slice(0, 8)
      .map((item) => item.memory)
    : [];
  if (relevantMemories.length) {
    lines.push('[MOST RELEVANT SHARED FACTS]');
    relevantMemories.forEach((memory) => lines.push('  - ' + String(memory && memory.text || '').trim()));
  }
  const explicitMemories = sorted
    .filter((memory) => /^(direct-user-remember|implicit-profile-remember)$/i.test(String(memory && memory.source || '')) || !!(memory && memory.pinned))
    .slice(-12);
  if (explicitMemories.length) {
    lines.push('[USER-DECLARED FACTS]');
    explicitMemories.forEach((memory) => lines.push('  - ' + String(memory && memory.text || '').trim()));
  }
  categoryOrder.forEach((category) => {
    if (!groups.has(category)) return;
    const items = groups.get(category).slice(-8);
    if (!items.length) return;
    lines.push('[' + category.toUpperCase() + ']');
    items.forEach((memory) => lines.push('  - ' + String(memory && memory.text || '').trim()));
  });
  Array.from(groups.keys()).forEach((category) => {
    if (categoryOrder.indexOf(category) >= 0) return;
    const items = groups.get(category).slice(-6);
    if (!items.length) return;
    lines.push('[' + category.toUpperCase() + ']');
    items.forEach((memory) => lines.push('  - ' + String(memory && memory.text || '').trim()));
  });

  return lines.length ? '\n\n=== SALIENT MEMORIES ABOUT THIS PERSON ===\n' + lines.join('\n') : '';
}

async function buildSearchContext(query, options) {
  const state = {
    searchContext: '',
    searchState: 'not-needed',
    searchProvider: 'none'
  };

  if (!options.needsSearch) return state;

  const serperKey = String(options.serperKey || '').trim();
  const braveKey = String(options.braveKey || '').trim();
  const tavilyKey = String(options.tavilyKey || '').trim();
  state.searchState = (serperKey || braveKey || tavilyKey) ? 'attempted' : 'unavailable';

  if (serperKey) {
    try {
      const looksNewsy = /\b(latest|news|today|tonight|tomorrow|recent|current|update|updates|happening)\b/i.test(query);
      const endpoint = looksNewsy ? 'https://google.serper.dev/news' : 'https://google.serper.dev/search';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, gl: 'us', hl: 'en', num: 6 })
      });
      if (response.ok) {
        const data = await response.json();
        const results = looksNewsy
          ? (Array.isArray(data.news) ? data.news : [])
          : [...(Array.isArray(data.organic) ? data.organic : []), ...(Array.isArray(data.news) ? data.news : [])];

        if (results.length) {
          const snippets = results.slice(0, 6).map((result, index) =>
            (index + 1) + '. ' + (result.title || '') + '\n   ' + (result.snippet || '') + '\n   Source: ' + (result.link || '')
          );
          state.searchContext = '\n\n=== WEB SEARCH RESULTS (live) ===\nQuery: "' + query.slice(0, 120) + '"\n' + snippets.join('\n') + '\n\nUse these results for any time-sensitive claim. Cite the source names naturally and prefer saying you are unsure over filling gaps.';
          state.searchState = 'results';
          state.searchProvider = 'serper';
        } else {
          state.searchState = 'empty';
        }

        if (!looksNewsy && data.answerBox) {
          state.searchContext += '\n\nAnswer box: ' + (data.answerBox.title || data.answerBox.answer || data.answerBox.snippet || '');
        }
        if (!looksNewsy && data.knowledgeGraph) {
          state.searchContext += '\n\nKnowledge panel: ' + (data.knowledgeGraph.title || '') + ' - ' + (data.knowledgeGraph.description || '');
        }
      } else {
        state.searchState = 'failed';
      }
    } catch (error) {
      state.searchState = 'failed';
    }
  }

  if (state.searchState !== 'results' && braveKey) {
    try {
      const response = await fetch(
        'https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(query) + '&count=6&text_decorations=false',
        { headers: { Accept: 'application/json', 'X-Subscription-Token': braveKey } }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.web && Array.isArray(data.web.results) && data.web.results.length) {
          const snippets = data.web.results.slice(0, 6).map((result, index) =>
            (index + 1) + '. ' + (result.title || '') + '\n   ' + (result.description || '') + '\n   Source: ' + (result.url || '')
          );
          state.searchContext = '\n\n=== WEB SEARCH RESULTS (live) ===\nQuery: "' + query.slice(0, 120) + '"\n' + snippets.join('\n') + '\n\nUse these results for any time-sensitive claim. Cite the source names naturally and prefer saying you are unsure over filling gaps.';
          state.searchState = 'results';
          state.searchProvider = 'brave';
        } else {
          state.searchState = 'empty';
        }
        if (data.infobox) {
          state.searchContext += '\n\nKnowledge panel: ' + (data.infobox.title || '') + ' - ' + (data.infobox.description || '');
        }
      } else {
        state.searchState = 'failed';
      }
    } catch (error) {
      state.searchState = 'failed';
    }
  }

  if (state.searchState !== 'results' && tavilyKey) {
    try {
      const looksNewsy = /\b(latest|news|today|tonight|tomorrow|recent|current|update|updates|happening)\b/i.test(query);
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + tavilyKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          topic: looksNewsy ? 'news' : 'general',
          search_depth: 'basic',
          max_results: 6,
          include_answer: false,
          include_raw_content: false
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.results) && data.results.length) {
          const snippets = data.results.slice(0, 6).map((result, index) =>
            (index + 1) + '. ' + (result.title || '') + '\n   ' + (result.content || '') + '\n   Source: ' + (result.url || '')
          );
          state.searchContext = '\n\n=== WEB SEARCH RESULTS (live) ===\nQuery: "' + query.slice(0, 120) + '"\n' + snippets.join('\n') + '\n\nUse these results for any time-sensitive claim. Cite the source names naturally and prefer saying you are unsure over filling gaps.';
          state.searchState = 'results';
          state.searchProvider = 'tavily';
        } else {
          state.searchState = 'empty';
        }
      } else {
        state.searchState = 'failed';
      }
    } catch (error) {
      state.searchState = 'failed';
    }
  }

  return state;
}

export function buildActiveSystemPromptPart(systemPromptOverride, forceFullContext) {
  if (!systemPromptOverride || !String(systemPromptOverride).trim()) return '';
  return `
=== ACTIVE USER SYSTEM PROMPT ===
- Treat the following as the current persistent user-selected system prompt until the user changes it.
- Follow it unless it conflicts with security constraints or the web reliability rules.
- This overrides Joey's default persona/style whenever it specifies a different persona, tone, or role.
${clampText(systemPromptOverride, forceFullContext ? 20000 : 12000)}`;
}

export function buildSearchRulesPart(searchState, searchProvider, forceWebSearch, forceFullContext) {
  return `
=== WEB RELIABILITY RULES ===
- For current events, recent news, live prices, schedules, reviews, rankings, or anything that depends on the web right now, do not answer from memory alone.
- Search status for this turn: ${searchState}.
- Search provider for this turn: ${searchProvider}.
- Forced live search mode: ${forceWebSearch ? 'yes' : 'no'}.
- Forced deep context mode: ${forceFullContext ? 'yes' : 'no'}.
- If search status is "results", ground the answer in the provided WEB SEARCH RESULTS and cite source names or domains naturally.
- If search status is not "results" but the user is asking for current or web-dependent information, say plainly that you couldn't verify it live right now and ask the user to retry. Do not guess, invent sources, or act certain.
- If the user explicitly asks you to search, treat that as a requirement for live verification.`;
}

export function buildSearchGroundingPart(needsSearch) {
  if (!needsSearch) return '';
  return `
=== SEARCH-GROUNDED ANSWER MODE ===
- This turn requires a web-grounded answer.
- Use only the WEB SEARCH RESULTS for factual claims.
- Do not answer from model memory, prior beliefs, or unstated assumptions.
- If the results are incomplete or conflicting, say that clearly.
- Include a short "Sources:" line at the end with the source domains or titles you relied on.
- If search status is not "results", reply that live verification failed and do not provide the requested facts anyway.`;
}

export async function handleJoeyGatewayRequest(req, res, options) {
  const config = options && typeof options === 'object' ? options : {};
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, passphrase, systemPromptOverride, savedQuotesContent, chatClearedAt, deviceId, deviceLabel } = req.body || {};
  if (!passphrase) return res.status(401).json({ error: 'Missing passphrase' });
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'Missing messages' });

  const supabaseEnabled = isSupabaseConfigured();
  let redisFetch;

  if (supabaseEnabled) {
    const supabase = createAdminClient();
    const userId = String(process.env.SUPABASE_OWNER_ID || '').trim();
    redisFetch = createSupabaseRedisFetch(supabase, userId);
  } else {
    redisFetch = createRedisFetch();
    const { url: redisUrl, token: redisToken } = getRedisConfig();
    if (!redisUrl || !redisToken || !redisFetch) {
      return res.status(500).json({ error: 'Redis not configured' });
    }
  }

  try {
    let isValid;
    if (supabaseEnabled) {
      const adminHash = String(process.env.HOMER_ADMIN_HASH || '').trim();
      isValid = !!adminHash && String(passphrase || '').trim() === adminHash;
    } else {
      isValid = await verifyJoeyPassphrase(passphrase, redisFetch);
    }
    if (!isValid) return res.status(403).json({ error: 'Forbidden' });

    const mode = getJoeyMode(req);
    const modeLabel = getJoeyModeLabel(mode);
    const keys = getJoeyContextKeys(mode);
    const { FILES_KEY } = keys;

    const provider = typeof config.getProviderConfig === 'function'
      ? config.getProviderConfig({ mode, env: process.env })
      : {};

    const gatewayUrl = String(provider.gatewayUrl || '').trim().replace(/\/+$/, '');
    const gatewayToken = String(provider.gatewayToken || '').trim();
    const primaryModel = String(provider.primaryModel || '').trim();
    const fallbackModel = String(provider.fallbackModel || '').trim();
    const largeContext = !!provider.largeContext;

    if (!gatewayUrl || !primaryModel) {
      return res.status(500).json({ error: 'Gateway not configured' });
    }

    const lastUserMessage = messages.filter((message) => message.role === 'user').pop();
    const rawLastUserContent = String((lastUserMessage && lastUserMessage.content) || '');
    const forceWebSearch = /\[FORCE_WEB_SEARCH\]/i.test(rawLastUserContent);
    const forceFullContext = /\[(USE_FULL_CONTEXT|DEEP_CONTEXT)\]/i.test(rawLastUserContent);
    const userQuery = sanitizeUserQuery(rawLastUserContent);
    const needsSearch = forceWebSearch || isWebSearchIntent(userQuery);

    const primedState = await primeSharedStateFromIncomingTurn(redisFetch, keys, mode, messages, {
      chatClearedAt,
      deviceId,
      deviceLabel
    });
    const memories = asArray(primedState.memories);
    const profile = asObject(primedState.profile);
    const historyMessages = asArray(primedState.history);
    const filesBundleRaw = await loadRedisJson(redisFetch, FILES_KEY, {});
    const filesBundle = filesBundleRaw && typeof filesBundleRaw === 'object' ? { ...filesBundleRaw } : {};
    if (typeof savedQuotesContent === 'string') {
      const quotesFile = buildQuotesFileFromSavedContent(savedQuotesContent);
      if (quotesFile.trim()) filesBundle['Quotes.md'] = quotesFile;
    }

    const selectionLargeContext = typeof config.getSelectionLargeContext === 'function'
      ? !!config.getSelectionLargeContext({ mode, largeContext, provider })
      : largeContext;
    const orderedFiles = filesBundle && typeof filesBundle === 'object'
      ? selectContextFiles(filesBundle, userQuery, {
          deep: forceFullContext,
          largeContext: selectionLargeContext,
          personal: mode !== 'work',
          work: mode === 'work'
        })
      : [];
    const filesText = orderedFiles.length ? '\n\n=== CANONICAL ' + modeLabel.toUpperCase() + ' FILES ===\n' + orderedFiles.join('\n\n') : '';
    const profileText = buildProfileText(profile);
    const memoriesText = buildMemoriesText(memories, userQuery);

    const search = await buildSearchContext(userQuery, {
      needsSearch,
      serperKey: process.env.SERPER_API_KEY,
      braveKey: process.env.BRAVE_SEARCH_API_KEY,
      tavilyKey: process.env.TAVILY_API_KEY
    });

    const systemParts = typeof config.buildSystemParts === 'function'
      ? config.buildSystemParts({
          mode,
          modeLabel,
          largeContext,
          forceFullContext,
          forceWebSearch,
          needsSearch,
          systemPromptOverride,
          profileText,
          memoriesText,
          filesText,
          searchContext: search.searchContext,
          searchState: search.searchState,
          searchProvider: search.searchProvider,
          clampText
        })
      : [];

    const systemContent = systemParts.filter(Boolean).join('\n').trim();
    const backfillLimit = typeof config.getBackfillLimit === 'function'
      ? config.getBackfillLimit({ forceFullContext, largeContext, mode })
      : (forceFullContext ? 32 : 16);
    const clearedAt = Number(chatClearedAt || 0) || 0;
    const suppressBackfill = !!clearedAt && (Date.now() - clearedAt) < (30 * 60 * 1000);
    const backfillMessages = suppressBackfill ? [] : getBackfillMessages(historyMessages, messages, backfillLimit);

    const finalMessages = [];
    if (systemContent) finalMessages.push({ role: 'system', content: systemContent });
    if (backfillMessages.length) {
      finalMessages.push({ role: 'system', content: '--- Previous conversation (for continuity) ---' });
      finalMessages.push(...backfillMessages);
      finalMessages.push({ role: 'system', content: '--- Current conversation ---' });
    }
    finalMessages.push(...messages);

    const headers = { 'Content-Type': 'application/json' };
    if (gatewayToken) headers.Authorization = 'Bearer ' + gatewayToken;

    res.setHeader('X-OpenClaw-Search-State', search.searchState);
    res.setHeader('X-OpenClaw-Search-Provider', search.searchProvider);
    res.setHeader('X-OpenClaw-Mode', mode);

    const modelsToTry = [primaryModel];
    if (fallbackModel && fallbackModel !== primaryModel) modelsToTry.push(fallbackModel);

    let upstream = null;
    let activeModel = primaryModel;
    let lastErrorStatus = 502;
    let lastErrorBody = '';

    for (const modelName of modelsToTry) {
      activeModel = modelName;
      upstream = await fetch(buildChatUrl(gatewayUrl), {
        method: 'POST',
        headers,
        body: JSON.stringify(typeof config.buildUpstreamBody === 'function'
          ? config.buildUpstreamBody({ modelName, finalMessages, largeContext, mode })
          : { model: modelName, messages: finalMessages, stream: true })
      });

      if (upstream.ok) break;

      lastErrorStatus = upstream.status;
      lastErrorBody = await upstream.text().catch(() => upstream.statusText);
      const retryable = upstream.status === 429 || /rate_limit|tokens|rate limit/i.test(lastErrorBody);
      if (!retryable || modelName === modelsToTry[modelsToTry.length - 1]) {
        upstream = null;
        break;
      }
    }

    if (!upstream) {
      return res.status(lastErrorStatus).send(lastErrorBody || 'Upstream request failed');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-OpenClaw-Model', activeModel);
    res.setHeader('X-OpenClaw-Primary-Model', primaryModel);
    res.setHeader('X-OpenClaw-Fallback-Used', activeModel !== primaryModel ? '1' : '0');

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
    } catch (error) {}

    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        error: config.gatewayErrorMessage || 'Joey request failed',
        detail: error.message
      });
    }
  }
}

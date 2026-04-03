import { buildContextFiles, compactFileLibraryEntries } from './context-files.js';
import { getJoeyContextKeys, getJoeyMode } from './joey-context.js';
import { computeJoeySyncMeta } from './joey-sync-meta.js';
import {
  createAdminClient,
  createUserClient,
  isSupabaseConfigured,
  verifySupabaseJwt
} from './supabase-server.js';
import { createSupabaseRedisFetch } from './supabase-redis-compat.js';
import {
  createRedisFetch,
  fetchWithRedirects,
  getGoogleDriveConfig,
  getRedisConfig,
  loadRedisJson,
  saveRedisJson,
  verifyJoeyPassphrase
} from './joey-server.js';

const MAX_HISTORY = 100;
const MAX_MEMORIES = 320;
const MAX_JOURNAL = 1800;
const GDRIVE_BACKUP_TIMEOUT_MS = 60000;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

async function appendJournalEntries(redisFetch, journalKey, entries) {
  const nextEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
  if (!nextEntries.length) return loadRedisJson(redisFetch, journalKey, []);
  const current = await loadRedisJson(redisFetch, journalKey, []);
  const merged = current.concat(nextEntries).slice(-MAX_JOURNAL);
  await saveRedisJson(redisFetch, journalKey, merged);
  return merged;
}

function buildChatUrl(baseUrl) {
  const normalized = String(baseUrl || '').replace(/\/+$/, '');
  if (/\/openai\/v1$/i.test(normalized) || /\/v1$/i.test(normalized)) {
    return normalized + '/chat/completions';
  }
  return normalized + '/v1/chat/completions';
}

function parseLLMJson(raw) {
  let cleaned = String(raw || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const start = cleaned.indexOf('{');
    if (start === -1) throw error;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let index = start; index < cleaned.length; index += 1) {
      const ch = cleaned[index];
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
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          return JSON.parse(cleaned.slice(start, index + 1));
        }
      }
    }
    throw error;
  }
}

function similarity(a, b) {
  const wordsA = new Set(String(a || '').split(/\s+/).filter(Boolean));
  const wordsB = new Set(String(b || '').split(/\s+/).filter(Boolean));
  let intersection = 0;
  wordsA.forEach((word) => {
    if (wordsB.has(word)) intersection += 1;
  });
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function uniqueStringList(items) {
  const out = [];
  const seen = new Set();
  asArray(items).forEach((item) => {
    const value = String(item || '').trim();
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(value);
  });
  return out;
}

function appendProfilePreferences(profile, entries) {
  const next = asObject(profile);
  const merged = uniqueStringList([].concat(asArray(next.preferences), asArray(entries)));
  if (merged.length) next.preferences = merged;
  return next;
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

function historyIsPrefix(prefix, whole) {
  const left = Array.isArray(prefix) ? prefix : [];
  const right = Array.isArray(whole) ? whole : [];
  if (left.length > right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (!sameHistoryMessage(left[index], right[index])) return false;
  }
  return true;
}

function historyTailHeadOverlap(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  const max = Math.min(left.length, right.length);
  for (let size = max; size > 0; size -= 1) {
    let ok = true;
    for (let index = 0; index < size; index += 1) {
      if (!sameHistoryMessage(left[left.length - size + index], right[index])) {
        ok = false;
        break;
      }
    }
    if (ok) return size;
  }
  return 0;
}

export function mergeHistoryMessages(existing, incoming, options = {}) {
  const current = asArray(existing).map(normalizeHistoryMessage).filter(Boolean).slice(-MAX_HISTORY);
  const next = asArray(incoming).map(normalizeHistoryMessage).filter(Boolean).slice(-MAX_HISTORY);
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

  const merged = current.concat(next).sort((a, b) => {
    const aTs = Number(a && a.ts) || 0;
    const bTs = Number(b && b.ts) || 0;
    if (aTs !== bTs) return aTs - bTs;
    return 0;
  });
  const deduped = [];
  const seen = new Set();
  merged.forEach((item) => {
    const key = String(item.ts || 0) + '|' + item.role + '|' + item.content;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(item);
  });
  return deduped.slice(-MAX_HISTORY);
}

export function extractDeterministicMemories(messages, mode, profile) {
  const currentProfile = asObject(profile);
  const recentUserMessages = asArray(messages).filter((item) => item && item.role === 'user');
  const memories = [];
  const preferenceEntries = [];
  const seen = new Set();
  const profilePatch = {};

  function pushMemory(text, category, extraProfileValue) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return;
    const key = String(category || 'fact').toLowerCase() + '|' + clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    memories.push({
      text: clean,
      category: category || 'fact',
      source: 'deterministic-learn',
      confidence: 0.99
    });
    if (extraProfileValue) preferenceEntries.push(String(extraProfileValue).trim());
  }

  recentUserMessages.slice(-8).forEach((item) => {
    const raw = String(item.content || '').replace(/\s+/g, ' ').trim();
    if (!raw) return;
    const body = raw.replace(/^(?:please\s+)?(?:remember|save|store|keep\s+in\s+mind|note)\s+(?:that\s+)?/i, '').trim();
    if (!body) return;

    let match = body.match(/^my\s+favou?rite\s+([a-z][a-z0-9 _-]{1,30})\s+is\s+(.+)$/i);
    if (match) {
      const subject = String(match[1] || '').trim().toLowerCase();
      const value = String(match[2] || '').trim().replace(/[.?!]+$/g, '');
      if (value) {
        pushMemory('Favorite ' + subject + ': ' + value, 'preference', 'Favorite ' + subject + ': ' + value);
        if (subject === 'color' || subject === 'colour') profilePatch.favorite_color = value;
      }
      return;
    }

    match = body.match(/^i\s+prefer\s+(.+)$/i);
    if (match) {
      const value = String(match[1] || '').trim().replace(/[.?!]+$/g, '');
      if (value) {
        pushMemory('User prefers ' + value, 'preference', 'Prefers ' + value);
      }
      return;
    }

    match = body.match(/^i\s+(always|usually|never)\s+(.+)$/i);
    if (match) {
      const habitText = String(match[1] || '').trim().toLowerCase() + ' ' + String(match[2] || '').trim().replace(/[.?!]+$/g, '');
      if (habitText) pushMemory('User ' + habitText, 'routine', habitText);
      return;
    }

    match = body.match(/^my\s+name\s+is\s+(.+)$/i);
    if (match && !currentProfile.name) {
      const value = String(match[1] || '').trim().replace(/[.?!]+$/g, '');
      if (value) {
        profilePatch.name = value;
        pushMemory('Name: ' + value, 'fact');
      }
      return;
    }

    if (/^(?:remember|save|store|keep\s+in\s+mind|note)\b/i.test(raw) || /^(?:that\s+)?(?:i|my)\b/i.test(body)) {
      const category = /\bprefer|preference|favorite|favourite|like|love\b/i.test(body)
        ? 'preference'
        : /\bhabit|routine|always|usually|never\b/i.test(body)
        ? 'routine'
        : 'fact';
      const cleanBody = body.replace(/[.?!]+$/g, '').trim();
      if (cleanBody.length >= 6) pushMemory(cleanBody, category, category === 'preference' ? cleanBody : '');
    }
  });

  if (preferenceEntries.length) {
    profilePatch.preferences = uniqueStringList([].concat(asArray(currentProfile.preferences), preferenceEntries));
  }

  return {
    memories,
    profile: appendProfilePreferences(profilePatch, profilePatch.preferences || [])
  };
}

export async function runLearnStep({ mode, messages, redisFetch, keys }) {
  const recentMsgs = Array.isArray(messages)
    ? messages.filter((item) => item && (item.role === 'user' || item.role === 'assistant')).slice(-8)
    : [];
  if (recentMsgs.length < 1) {
    return { ok: true, skipped: true, reason: 'Not enough messages to learn from' };
  }

  const [existing, profile] = await Promise.all([
    loadRedisJson(redisFetch, keys.MEMORY_KEY, []),
    loadRedisJson(redisFetch, keys.PROFILE_KEY, {})
  ]);
  const existingMemories = asArray(existing);
  const profileObject = asObject(profile);
  const deterministic = extractDeterministicMemories(recentMsgs, mode, profileObject);

  const isWork = mode === 'work';
  const gatewayUrl = String(
    isWork
      ? (process.env.OC_WORK_GATEWAY_URL || process.env.OC_GATEWAY_URL || 'https://api.kilo.ai/api/gateway')
      : (process.env.OC_PERSONAL_GATEWAY_URL || process.env.NEMOCLAW_GATEWAY_URL || process.env.OC_GATEWAY_URL || 'http://localhost:11434')
  ).trim().replace(/\/+$/, '');
  const gatewayToken = String(
    isWork
      ? (process.env.OC_WORK_GATEWAY_TOKEN || process.env.OC_GATEWAY_TOKEN || '')
      : (process.env.OC_PERSONAL_GATEWAY_TOKEN || process.env.NEMOCLAW_GATEWAY_TOKEN || process.env.OC_GATEWAY_TOKEN || '')
  ).trim();
  const model = String(
    isWork
      ? (process.env.OC_WORK_MODEL || 'minimax-m2.7:cloud')
      : (process.env.OC_PERSONAL_MODEL || process.env.KIMI_MODEL || process.env.OC_MODEL || 'kimi-k2.5:cloud')
  ).trim();
  const canUseModel = !!(gatewayUrl && model && recentMsgs.length >= 2);

  const existingText = existingMemories.length ? existingMemories.map((item) => '- [' + item.category + '] ' + item.text).join('\n') : '(none yet)';
  const profileText = Object.keys(profileObject).length ? JSON.stringify(profileObject, null, 1) : '(empty)';

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

1. EXTRACT NEW MEMORIES - facts about the user worth remembering permanently
2. UPDATE USER PROFILE - maintain a living profile of who this person is

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
- Track: name, nickname, location, timezone, profession, interests, communication_style, current_mood, people, active_goals, recent_topics, languages, important_dates, routines, preferences, working_style, recurring_stressors, motivators

Return ONLY this JSON:
{
  "memories": [{"text": "fact", "category": "category", "source": "auto-learn", "confidence": 0.0-1.0}],
  "profile": { ...full updated profile object... }
}`;

  let result = { memories: [], profile: profileObject };
  let modelError = '';
  if (canUseModel) {
    const headers = { 'Content-Type': 'application/json' };
    if (gatewayToken) headers.Authorization = 'Bearer ' + gatewayToken;
    try {
      const llmResponse = await fetch(buildChatUrl(gatewayUrl), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: extractPrompt },
            ...recentMsgs.map((item) => ({ role: item.role, content: String(item.content || '') })),
            { role: 'user', content: 'Extract memories and update profile. Return JSON only.' }
          ],
          temperature: 0.1,
          max_tokens: 1800
        })
      }).then((response) => response.json());

      const rawContent = (((llmResponse || {}).choices || [])[0] || {}).message
        ? llmResponse.choices[0].message.content
        : '{}';
      result = parseLLMJson(rawContent);
    } catch (error) {
      modelError = error && error.message ? error.message : 'Learn model failed';
      result = { memories: [], profile: profileObject };
    }
  }

  const combinedFacts = []
    .concat(Array.isArray(result.memories) ? result.memories : [])
    .concat(asArray(deterministic.memories));
  const updatedProfile = {
    ...asObject(result.profile && typeof result.profile === 'object' ? result.profile : profileObject),
    ...asObject(deterministic.profile)
  };

  updatedProfile._lastUpdated = new Date().toISOString();
  await saveRedisJson(redisFetch, keys.PROFILE_KEY, updatedProfile);

  const existingLower = existingMemories.map((item) => String(item.text || '').toLowerCase());
  const acceptedLower = new Set();
  const genuinelyNew = combinedFacts.filter((fact) => {
    if (!fact || typeof fact.text !== 'string' || fact.text.length < 5) return false;
    const lower = fact.text.toLowerCase();
    if (acceptedLower.has(lower)) return false;
    const isDup = existingLower.some((existingItem) => (
      existingItem.includes(lower) || lower.includes(existingItem) || similarity(existingItem, lower) > 0.85
    ));
    if (isDup) return false;
    acceptedLower.add(lower);
    return true;
  });

  let updated = existingMemories.slice();
  genuinelyNew.forEach((fact) => {
    const confidence = typeof fact.confidence === 'number' ? Math.max(0, Math.min(1, fact.confidence)) : 0.72;
    updated.push({
      id: Date.now() + Math.random(),
      text: fact.text.slice(0, 500),
      category: fact.category || 'general',
      ts: Date.now(),
      auto: true,
      source: fact.source || 'auto-learn',
      confidence,
      pinned: String(fact.category || '').toLowerCase() === 'pin'
    });
  });

  if (updated.length > 150) {
    updated.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const toKeep = updated.slice(-100);
    const toConsolidate = updated.slice(0, -100);
    if (toConsolidate.length >= 10) {
      const groups = {};
      toConsolidate.forEach((item) => {
        const category = item.category || 'general';
        if (!groups[category]) groups[category] = [];
        groups[category].push(item.text);
      });
      const summaries = Object.entries(groups).map(([category, texts]) => {
        const unique = [...new Set(texts)];
        return {
          id: Date.now() + Math.random(),
          text: '[CONSOLIDATED] ' + unique.join(' | '),
          category,
          ts: Date.now(),
          consolidated: true,
          sourceCount: unique.length
        };
      });
      updated = summaries.concat(toKeep);
    }
  }

  while (updated.length > MAX_MEMORIES) updated.shift();
  await saveRedisJson(redisFetch, keys.MEMORY_KEY, updated);

  return {
    ok: true,
    learned: genuinelyNew.length,
    facts: genuinelyNew.map((fact) => fact.text),
    profileUpdated: true,
    totalMemories: updated.length,
    deterministic: asArray(deterministic.memories).length,
    warning: modelError || undefined,
    skipped: !canUseModel && genuinelyNew.length === 0,
    reason: !canUseModel && genuinelyNew.length === 0 ? 'Learn model is not configured' : undefined
  };
}

async function runDriveBackup({ mode, payload }) {
  const { webhook: gdriveWebhook, secret: gdriveSecret } = getGoogleDriveConfig();
  if (!gdriveWebhook || !gdriveSecret) {
    return { ok: false, error: 'Google Drive backup is not configured' };
  }

  const response = await fetchWithRedirects(gdriveWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    timeoutMs: GDRIVE_BACKUP_TIMEOUT_MS,
    body: JSON.stringify({
      secret: gdriveSecret,
      mode,
      profile: payload.profile,
      memories: payload.memories,
      history: payload.history,
      files: payload.files,
      fileLibrary: payload.fileLibrary,
      customFiles: payload.customFiles,
      journal: payload.journal,
      syncMeta: payload.syncMeta
    })
  });

  if (!response.text) {
    return { ok: false, error: response.error || 'No response after redirects', redirectChain: response.redirectChain || [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(response.text);
  } catch (error) {
    return { ok: false, error: 'Non-JSON response from Google Drive script', status: response.status };
  }

  if (!response.ok || parsed.error) {
    return {
      ok: false,
      error: parsed.error || 'Google Drive backup failed',
      status: response.status,
      redirectChain: response.redirectChain || []
    };
  }

  return {
    ok: true,
    drive: parsed,
    historyCount: payload.history.length,
    memoryCount: payload.memories.length
  };
}

export default async function handleJoeyCommit(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const passphrase = body.passphrase;
  const authHeader = String(req.headers.authorization || '');
  const jwtToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const skipDrive = !!body.skipDrive;
  const chatClearedAt = Number(body.chatClearedAt || 0);
  if (!passphrase && !jwtToken) return res.status(401).json({ error: 'Missing credentials' });

  const mode = getJoeyMode(req);
  const keys = getJoeyContextKeys(mode);
  const legacyRedisFetch = createRedisFetch();
  const { url: redisUrl, token: redisToken } = getRedisConfig();

  try {
    const supabaseEnabled = isSupabaseConfigured();
    let redisFetch = null;
    let isValid = false;

    if (jwtToken && supabaseEnabled) {
      const user = await verifySupabaseJwt(jwtToken);
      if (user) {
        redisFetch = createSupabaseRedisFetch(createUserClient(jwtToken), user.id);
        isValid = true;
      }
    }

    if (!isValid && passphrase) {
      const adminHash = String(process.env.HOMER_ADMIN_HASH || '').trim();
      isValid = !!adminHash && String(passphrase || '').trim() === adminHash;
      if (!isValid && legacyRedisFetch) {
        isValid = await verifyJoeyPassphrase(passphrase, legacyRedisFetch);
      }
      if (!isValid) return res.status(403).json({ error: 'Forbidden' });

      if (supabaseEnabled) {
        const ownerId = String(process.env.SUPABASE_OWNER_ID || '').trim();
        if (ownerId) {
          redisFetch = createSupabaseRedisFetch(createAdminClient(), ownerId);
        }
      }
      if (!redisFetch) {
        if (!redisUrl || !redisToken || !legacyRedisFetch) return res.status(500).json({ error: 'Redis not configured' });
        redisFetch = legacyRedisFetch;
      }
    }

    if (!isValid) return res.status(403).json({ error: 'Forbidden' });
    if (!redisFetch) return res.status(500).json({ error: 'Data store unavailable' });

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const previousHistory = await loadRedisJson(redisFetch, keys.HISTORY_KEY, []);
    const history = mergeHistoryMessages(
      previousHistory,
      messages.map(normalizeHistoryMessage).filter(Boolean),
      { clearedAt: chatClearedAt }
    );

    const commitTs = Date.now();
    const commitIso = new Date(commitTs).toISOString();
    const steps = {
      history: { ok: true, count: history.length },
      learn: { ok: true, skipped: true, reason: 'No learn step run' },
      files: { ok: false },
      drive: { ok: false },
      syncMeta: { ok: false }
    };

    await saveRedisJson(redisFetch, keys.HISTORY_KEY, history);
    const historyJournalEntries = [];
    const prior = Array.isArray(previousHistory) ? previousHistory : [];
    const priorLooksPrefix = historyIsPrefix(prior, history);
    if (priorLooksPrefix) {
      history.slice(prior.length).forEach((item) => {
        historyJournalEntries.push(buildJournalEntry('message', {
          role: item.role,
          text: item.content,
          source: 'joey-commit'
        }));
      });
    } else if (!history.length && chatClearedAt > 0) {
      historyJournalEntries.push(buildJournalEntry('history-cleared', {
        text: 'Chat cleared',
        source: 'joey-commit',
        ts: chatClearedAt
      }));
    } else {
      historyJournalEntries.push(buildJournalEntry('history-rewrite', {
        text: JSON.stringify(history.slice(-8)),
        source: 'joey-commit'
      }));
    }
    await appendJournalEntries(redisFetch, keys.JOURNAL_KEY, historyJournalEntries);

    if (body.skipLearn) {
      steps.learn = { ok: true, skipped: true, reason: 'Skipped by request' };
    } else {
      try {
        steps.learn = await runLearnStep({ mode, messages: history, redisFetch, keys });
        if (steps.learn && steps.learn.ok && Array.isArray(steps.learn.facts) && steps.learn.facts.length) {
          await appendJournalEntries(redisFetch, keys.JOURNAL_KEY, steps.learn.facts.map((fact) => (
            buildJournalEntry('memory-learned', {
              text: fact,
              source: 'auto-learn'
            })
          )));
        }
      } catch (error) {
        steps.learn = { ok: false, error: error.message || 'Learn step failed' };
      }
    }

    const effectiveTasks = Array.isArray(body.tasks) ? body.tasks : [];
    const [profile, memories, latestHistory, currentFiles, fileLibrary, customFiles, journal, storedSyncMeta] = await Promise.all([
      loadRedisJson(redisFetch, keys.PROFILE_KEY, {}),
      loadRedisJson(redisFetch, keys.MEMORY_KEY, []),
      loadRedisJson(redisFetch, keys.HISTORY_KEY, history),
      loadRedisJson(redisFetch, keys.FILES_KEY, {}),
      loadRedisJson(redisFetch, keys.FILE_LIBRARY_KEY, []),
      loadRedisJson(redisFetch, keys.CUSTOM_FILES_KEY, {}),
      loadRedisJson(redisFetch, keys.JOURNAL_KEY, []),
      loadRedisJson(redisFetch, keys.SYNC_META_KEY, {})
    ]);

    const compactFileLibrary = compactFileLibraryEntries(asArray(fileLibrary));
    if (JSON.stringify(compactFileLibrary) !== JSON.stringify(asArray(fileLibrary))) {
      await saveRedisJson(redisFetch, keys.FILE_LIBRARY_KEY, compactFileLibrary);
    }

    const files = buildContextFiles({
      profile: asObject(profile),
      memories: asArray(memories),
      history: asArray(latestHistory),
      tasks: effectiveTasks,
      fileLibrary: compactFileLibrary,
      existingFiles: asObject(currentFiles),
      customFiles: asObject(customFiles),
      scope: mode,
      generatedAt: commitIso
    });
    await saveRedisJson(redisFetch, keys.FILES_KEY, files);
    steps.files = { ok: true, count: Object.keys(files || {}).length };

    const syncMeta = computeJoeySyncMeta({
      mode,
      profile: asObject(profile),
      memories: asArray(memories),
      history: asArray(latestHistory),
      files,
      fileLibrary: compactFileLibrary,
      customFiles: asObject(customFiles),
      journal: asArray(journal)
    }, {
      ...(storedSyncMeta && typeof storedSyncMeta === 'object' ? storedSyncMeta : {}),
      mode,
      updatedAt: commitIso,
      lastCommittedAt: commitIso,
      lastSource: 'joey-commit'
    });
    await saveRedisJson(redisFetch, keys.SYNC_META_KEY, syncMeta);
    steps.syncMeta = { ok: true, updatedAt: syncMeta.updatedAt };

    if (skipDrive) {
      steps.drive = { ok: true, skipped: true, deferred: true, reason: 'Drive backup deferred by request' };
    } else {
      steps.drive = await runDriveBackup({
        mode,
        payload: {
          profile: asObject(profile),
          memories: asArray(memories),
          history: asArray(latestHistory),
          files,
          fileLibrary: compactFileLibrary,
          customFiles: asObject(customFiles),
          journal: asArray(journal),
          syncMeta
        }
      });
    }

    if (steps.drive.ok && !steps.drive.skipped) {
      const nextSyncMeta = {
        ...syncMeta,
        updatedAt: new Date().toISOString(),
        lastDriveBackupAt: steps.drive.drive && steps.drive.drive.exportedAt ? steps.drive.drive.exportedAt : commitIso,
        driveExportedAt: steps.drive.drive && steps.drive.drive.exportedAt ? steps.drive.drive.exportedAt : syncMeta.driveExportedAt || null,
        lastSource: 'joey-commit'
      };
      await saveRedisJson(redisFetch, keys.SYNC_META_KEY, nextSyncMeta);
      steps.syncMeta = { ok: true, updatedAt: nextSyncMeta.updatedAt };
    }

    const ok = !!(steps.history.ok && steps.files.ok && steps.drive.ok);
    const partial = !ok && !!(steps.history.ok || steps.files.ok || steps.drive.ok);

    let message = 'Memory commit failed.';
    if (ok) {
      message = skipDrive
        ? 'Memory committed to Redis and context files. Drive backup deferred.'
        : steps.learn && steps.learn.ok === false
        ? 'Memory committed to Redis and Google Drive. Learn step failed, but the commit completed.'
        : 'Memory committed to Redis and Google Drive.';
    } else if (partial && steps.history.ok && steps.files.ok && !steps.drive.ok) {
      message = 'Memory saved to Redis, but Google Drive backup failed.';
    } else if (partial && steps.history.ok && steps.files.ok) {
      message = 'Memory saved with partial issues. Check commit details.';
    }

    return res.status(200).json({
      ok,
      partial,
      committedAt: commitTs,
      mode,
      message,
      steps
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Commit failed' });
  }
}

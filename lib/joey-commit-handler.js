import { buildContextFiles } from './context-files.js';
import { getJoeyContextKeys, getJoeyMode } from './joey-context.js';
import { computeJoeySyncMeta } from './joey-sync-meta.js';
import {
  createRedisFetch,
  fetchWithRedirects,
  getGoogleDriveConfig,
  getRedisConfig,
  loadRedisJson,
  saveRedisJson,
  verifyJoeyPassphrase
} from './joey-server.js';

const MAX_HISTORY = 50;
const MAX_MEMORIES = 200;
const MAX_JOURNAL = 1000;

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

async function runLearnStep({ mode, messages, redisFetch, keys }) {
  const recentMsgs = Array.isArray(messages)
    ? messages.filter((item) => item && (item.role === 'user' || item.role === 'assistant')).slice(-8)
    : [];
  if (recentMsgs.length < 2) {
    return { ok: true, skipped: true, reason: 'Not enough messages to learn from' };
  }

  const gatewayUrl = String(process.env.OC_GATEWAY_URL || 'https://api.kilo.ai/api/gateway').trim().replace(/\/+$/, '');
  const gatewayToken = String(process.env.OC_GATEWAY_TOKEN || '').trim();
  const model = String(process.env.OC_MODEL || 'xiaomi/mimo-v2-pro:free').trim();
  if (!gatewayUrl || !model) {
    return { ok: true, skipped: true, reason: 'Learn model is not configured' };
  }

  const [existing, profile] = await Promise.all([
    loadRedisJson(redisFetch, keys.MEMORY_KEY, []),
    loadRedisJson(redisFetch, keys.PROFILE_KEY, {})
  ]);
  const existingMemories = asArray(existing);
  const profileObject = asObject(profile);

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
- Track: name, nickname, location, timezone, profession, interests, communication_style, current_mood, people, active_goals, recent_topics, languages, important_dates

Return ONLY this JSON:
{
  "memories": [{"text": "fact", "category": "category", "source": "auto-learn", "confidence": 0.0-1.0}],
  "profile": { ...full updated profile object... }
}`;

  const headers = { 'Content-Type': 'application/json' };
  if (gatewayToken) headers.Authorization = 'Bearer ' + gatewayToken;

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
      max_tokens: 1200
    })
  }).then((response) => response.json());

  const rawContent = (((llmResponse || {}).choices || [])[0] || {}).message
    ? llmResponse.choices[0].message.content
    : '{}';

  let result;
  try {
    result = parseLLMJson(rawContent);
  } catch (error) {
    return { ok: false, error: 'Unparseable response from learn model' };
  }

  const newFacts = Array.isArray(result.memories) ? result.memories : [];
  const updatedProfile = asObject(result.profile && typeof result.profile === 'object' ? result.profile : profileObject);

  updatedProfile._lastUpdated = new Date().toISOString();
  await saveRedisJson(redisFetch, keys.PROFILE_KEY, updatedProfile);

  const existingLower = existingMemories.map((item) => String(item.text || '').toLowerCase());
  const genuinelyNew = newFacts.filter((fact) => {
    if (!fact || typeof fact.text !== 'string' || fact.text.length < 5) return false;
    const lower = fact.text.toLowerCase();
    return !existingLower.some((existingItem) => (
      existingItem.includes(lower) || lower.includes(existingItem) || similarity(existingItem, lower) > 0.85
    ));
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
    totalMemories: updated.length
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
    body: JSON.stringify({
      secret: gdriveSecret,
      mode,
      profile: payload.profile,
      memories: payload.memories,
      history: payload.history,
      files: payload.files,
      fileLibrary: payload.fileLibrary,
      customFiles: payload.customFiles,
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const passphrase = body.passphrase;
  if (!passphrase) return res.status(401).json({ error: 'Missing passphrase' });

  const mode = getJoeyMode(req);
  const keys = getJoeyContextKeys(mode);
  const redisFetch = createRedisFetch();
  const { url: redisUrl, token: redisToken } = getRedisConfig();
  if (!redisUrl || !redisToken || !redisFetch) return res.status(500).json({ error: 'Redis not configured' });

  try {
    const isValid = await verifyJoeyPassphrase(passphrase, redisFetch);
    if (!isValid) return res.status(403).json({ error: 'Forbidden' });

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const previousHistory = await loadRedisJson(redisFetch, keys.HISTORY_KEY, []);
    const history = messages
      .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
      .map((item) => ({ role: item.role, content: String(item.content || '').slice(0, 2000) }))
      .slice(-MAX_HISTORY);

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
    const priorLooksPrefix = prior.length <= history.length && prior.every((item, index) => (
      item && history[index] &&
      item.role === history[index].role &&
      String(item.content || '') === String(history[index].content || '')
    ));
    if (priorLooksPrefix) {
      history.slice(prior.length).forEach((item) => {
        historyJournalEntries.push(buildJournalEntry('message', {
          role: item.role,
          text: item.content,
          source: 'joey-commit'
        }));
      });
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

    const effectiveTasks = mode === 'work' ? [] : (Array.isArray(body.tasks) ? body.tasks : []);
    const [profile, memories, latestHistory, fileLibrary, customFiles, journal, storedSyncMeta] = await Promise.all([
      loadRedisJson(redisFetch, keys.PROFILE_KEY, {}),
      loadRedisJson(redisFetch, keys.MEMORY_KEY, []),
      loadRedisJson(redisFetch, keys.HISTORY_KEY, history),
      loadRedisJson(redisFetch, keys.FILE_LIBRARY_KEY, []),
      loadRedisJson(redisFetch, keys.CUSTOM_FILES_KEY, {}),
      loadRedisJson(redisFetch, keys.JOURNAL_KEY, []),
      loadRedisJson(redisFetch, keys.SYNC_META_KEY, {})
    ]);

    const files = buildContextFiles({
      profile: asObject(profile),
      memories: asArray(memories),
      history: asArray(latestHistory),
      tasks: effectiveTasks,
      fileLibrary: asArray(fileLibrary),
      customFiles: asObject(customFiles),
      scope: mode
    });
    await saveRedisJson(redisFetch, keys.FILES_KEY, files);
    steps.files = { ok: true, count: Object.keys(files || {}).length };

    const syncMeta = computeJoeySyncMeta({
      mode,
      profile: asObject(profile),
      memories: asArray(memories),
      history: asArray(latestHistory),
      files,
      fileLibrary: asArray(fileLibrary),
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

    steps.drive = await runDriveBackup({
      mode,
      payload: {
        profile: asObject(profile),
        memories: asArray(memories),
        history: asArray(latestHistory).slice(-30),
        files,
        fileLibrary: asArray(fileLibrary),
        customFiles: asObject(customFiles),
        journal: asArray(journal),
        syncMeta
      }
    });

    if (steps.drive.ok) {
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
      message = steps.learn && steps.learn.ok === false
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

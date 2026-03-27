import { buildContextFiles } from '../lib/context-files.js';
import { getJoeyContextKeys, getJoeyMode } from '../lib/joey-context.js';

export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

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
    if (usersData.result) {
      try {
        const users = JSON.parse(usersData.result);
        for (const user of users) {
          if (user.passwordHash === passphrase.trim()) { isValid = true; break; }
        }
      } catch (e) {}
    }
  }
  if (!isValid) return res.status(403).json({ error: 'Forbidden' });

  const mode = getJoeyMode(req);
  const { MEMORY_KEY, HISTORY_KEY, PROFILE_KEY, FILES_KEY, FILE_LIBRARY_KEY, CUSTOM_FILES_KEY } = getJoeyContextKeys(mode);
  const MAX_MEMORIES = 200;
  const MAX_HISTORY = 50;

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
        const cleaned = messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role, content: (m.content || '').slice(0, 2000) }))
          .slice(-MAX_HISTORY);
        await redis(['SET', HISTORY_KEY, JSON.stringify(cleaned)]);
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
        const result = await redis(['GET', MEMORY_KEY]);
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
        await redis(['SET', MEMORY_KEY, JSON.stringify(memories)]);
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

    if (action === 'files') {
      if (req.method === 'GET') {
        const result = await redis(['GET', FILES_KEY]);
        const files = result.result ? JSON.parse(result.result) : {};
        return res.status(200).json({ files });
      }
      if (req.method === 'POST') {
        const { tasks } = req.body || {};
        const effectiveTasks = mode === 'work' ? [] : (Array.isArray(tasks) ? tasks : []);
        const [memRes, profileRes, histRes, libraryRes, customFilesRes] = await Promise.all([
          redis(['GET', MEMORY_KEY]),
          redis(['GET', PROFILE_KEY]),
          redis(['GET', HISTORY_KEY]),
          redis(['GET', FILE_LIBRARY_KEY]),
          redis(['GET', CUSTOM_FILES_KEY])
        ]);
        const files = buildContextFiles({
          profile: profileRes.result ? JSON.parse(profileRes.result) : {},
          memories: memRes.result ? JSON.parse(memRes.result) : [],
          history: histRes.result ? JSON.parse(histRes.result) : [],
          tasks: effectiveTasks,
          fileLibrary: libraryRes.result ? JSON.parse(libraryRes.result) : [],
          customFiles: customFilesRes.result ? JSON.parse(customFilesRes.result) : {},
          scope: mode
        });
        await redis(['SET', FILES_KEY, JSON.stringify(files)]);
        return res.status(200).json({ ok: true, files });
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
        const customFiles = result.result ? JSON.parse(result.result) : {};
        return res.status(200).json({ customFiles });
      }
      if (req.method === 'POST') {
        const { name, content } = req.body || {};
        if (!name || typeof content !== 'string') return res.status(400).json({ error: 'Missing name or content' });
        const safeName = String(name).trim().replace(/\.\./g, '').replace(/^\/+/, '').slice(0, 200);
        if (!safeName) return res.status(400).json({ error: 'Invalid file name' });
        const result = await redis(['GET', CUSTOM_FILES_KEY]);
        const customFiles = result.result ? JSON.parse(result.result) : {};
        if (!content.trim()) {
          delete customFiles[safeName];
        } else {
          customFiles[safeName] = content.trim().slice(0, 50000);
        }
        await redis(['SET', CUSTOM_FILES_KEY, JSON.stringify(customFiles)]);
        return res.status(200).json({ ok: true, name: safeName, count: Object.keys(customFiles).length });
      }
      if (req.method === 'DELETE') {
        const { name } = req.body || {};
        if (!name) return res.status(400).json({ error: 'Missing name' });
        const result = await redis(['GET', CUSTOM_FILES_KEY]);
        const customFiles = result.result ? JSON.parse(result.result) : {};
        delete customFiles[String(name).trim()];
        await redis(['SET', CUSTOM_FILES_KEY, JSON.stringify(customFiles)]);
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
        return JSON.parse(cleaned);
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

import crypto from 'crypto';

export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth
  const getPass = () => {
    if (req.method === 'GET') return req.query.passphrase;
    if (req.body && typeof req.body === 'object') return req.body.passphrase;
    return null;
  };
  const passphrase = getPass();
  if (!passphrase) return res.status(401).json({ error: 'Missing passphrase' });
  const ADMIN_HASH = (process.env.HOMER_ADMIN_HASH || '').trim();
  if (!ADMIN_HASH || passphrase.trim() !== ADMIN_HASH) return res.status(403).json({ error: 'Forbidden' });

  // Redis
  const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(500).json({ error: 'Redis not configured' });

  const MEMORY_KEY = 'joey:memories';
  const HISTORY_KEY = 'joey:history';
  const PROFILE_KEY = 'joey:profile';
  const MAX_MEMORIES = 200;
  const MAX_HISTORY = 50;

  async function redis(cmd) {
    const r = await fetch(REDIS_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN },
      body: JSON.stringify(cmd)
    });
    return r.json();
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
        const { memory, category } = req.body || {};
        if (!memory) return res.status(400).json({ error: 'Missing memory' });
        const result = await redis(['GET', MEMORY_KEY]);
        const memories = result.result ? JSON.parse(result.result) : [];
        memories.push({ id: Date.now(), text: memory, category: category || 'general', ts: Date.now() });
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

    // --- LEARN ACTION (POST only) ---
    if (action === 'learn' && req.method === 'POST') {
      const { messages } = req.body || {};
      if (!messages || !Array.isArray(messages) || messages.length < 2) {
        return res.status(400).json({ error: 'Need at least 2 messages' });
      }

      const GATEWAY_URL = (process.env.OC_GATEWAY_URL || 'http://localhost:18789').replace(/\/+$/, '');
      const GATEWAY_TOKEN = process.env.OC_GATEWAY_TOKEN || '';
      const MODEL = process.env.OC_MODEL || 'llama-3.3-70b-versatile';

      function llmCall(msgs, maxTokens) {
        const headers = { 'Content-Type': 'application/json' };
        if (GATEWAY_TOKEN) headers['Authorization'] = 'Bearer ' + GATEWAY_TOKEN;
        return fetch(GATEWAY_URL + '/v1/chat/completions', {
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

      const extractPrompt = `You are a personal memory & profile system. Analyze this conversation and do TWO things:

1. EXTRACT NEW MEMORIES — facts about the user worth remembering permanently
2. UPDATE USER PROFILE — maintain a living profile of who this person is

EXISTING MEMORIES (do NOT duplicate):
${existingText}

CURRENT PROFILE:
${profileText}

MEMORY RULES:
- Only extract facts NOT already in existing memories
- Categories: preference, fact, person, event, lesson, win, goal, habit, opinion, routine, health, work
- Each memory = one concise standalone fact
- Capture EMOTIONAL context too

PROFILE RULES:
- Update fields that changed, add new ones, keep existing ones
- Track: name, nickname, location, timezone, profession, interests, communication_style, current_mood, people, active_goals, recent_topics, languages, important_dates

Return ONLY this JSON:
{
  "memories": [{"text": "fact", "category": "category"}],
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
        updated.push({ id: Date.now() + Math.random(), text: fact.text.slice(0, 500), category: fact.category || 'general', ts: Date.now(), auto: true });
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

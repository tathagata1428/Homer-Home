export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth
  const { passphrase, messages } = req.body || {};
  if (!passphrase) return res.status(401).json({ error: 'Missing passphrase' });
  const ADMIN_HASH = (process.env.HOMER_ADMIN_HASH || '').trim();
  if (!ADMIN_HASH || passphrase.trim() !== ADMIN_HASH) return res.status(403).json({ error: 'Forbidden' });

  if (!messages || !Array.isArray(messages) || messages.length < 2) {
    return res.status(400).json({ error: 'Need at least 2 messages' });
  }

  // Redis + LLM config
  const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const GATEWAY_URL = (process.env.OC_GATEWAY_URL || 'http://localhost:18789').replace(/\/+$/, '');
  const GATEWAY_TOKEN = process.env.OC_GATEWAY_TOKEN || '';
  const MODEL = process.env.OC_MODEL || 'llama-3.3-70b-versatile';

  if (!REDIS_URL || !REDIS_TOKEN) return res.status(500).json({ error: 'Redis not configured' });

  const MEMORY_KEY = 'joey:memories';
  const PROFILE_KEY = 'joey:profile';
  const MAX_MEMORIES = 200;
  const CONSOLIDATION_THRESHOLD = 150;

  async function redis(cmd) {
    const r = await fetch(REDIS_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN },
      body: JSON.stringify(cmd)
    });
    return r.json();
  }

  function llmCall(msgs, maxTokens) {
    const headers = { 'Content-Type': 'application/json' };
    if (GATEWAY_TOKEN) headers['Authorization'] = 'Bearer ' + GATEWAY_TOKEN;
    return fetch(GATEWAY_URL + '/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: MODEL,
        messages: msgs,
        temperature: 0.1,
        max_tokens: maxTokens || 800
      })
    }).then(r => r.json());
  }

  function parseLLMJson(raw) {
    let cleaned = (raw || '').trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    return JSON.parse(cleaned);
  }

  try {
    // Load existing memories + profile in parallel
    const [memResult, profileResult] = await Promise.all([
      redis(['GET', MEMORY_KEY]),
      redis(['GET', PROFILE_KEY])
    ]);

    const existing = memResult.result ? JSON.parse(memResult.result) : [];
    const profile = profileResult.result ? JSON.parse(profileResult.result) : {};

    const existingText = existing.length
      ? existing.map(m => '- [' + m.category + '] ' + m.text).join('\n')
      : '(none yet)';

    const profileText = Object.keys(profile).length
      ? JSON.stringify(profile, null, 1)
      : '(empty)';

    // --- Single LLM call: extract memories + update profile ---
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
- Focus on: personal details, preferences, people & relationships, dates, goals, lessons learned, wins, habits, routines, opinions, health info, work details
- Skip: trivial chat, greetings, things the assistant said, questions without answers
- Each memory = one concise standalone fact
- Capture EMOTIONAL context too (e.g. "User was frustrated about X", "User is excited about Y")
- Capture TEMPORAL patterns (e.g. "Usually checks in mornings", "Works late on Wednesdays")

PROFILE RULES:
- The profile is a living document — update fields that changed, add new ones, keep existing ones
- Track: name, nickname, location, timezone, profession, interests, communication_style, current_mood, people (with relationships), active_goals, recent_topics, languages, important_dates
- Only update fields where the conversation reveals new/changed info
- Return the FULL updated profile (not just changes)

Return ONLY this JSON (no markdown, no explanation):
{
  "memories": [{"text": "fact", "category": "category"}],
  "profile": { ...full updated profile object... }
}

If no new memories, set memories to []. Always return the profile (even if unchanged).`;

    const recentMsgs = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-8); // Last 4 exchanges

    const llmData = await llmCall([
      { role: 'system', content: extractPrompt },
      ...recentMsgs,
      { role: 'user', content: 'Extract memories and update profile from the conversation above. Return JSON only.' }
    ], 1200);

    const rawContent = (llmData.choices && llmData.choices[0] && llmData.choices[0].message && llmData.choices[0].message.content) || '{}';

    let result;
    try {
      result = parseLLMJson(rawContent);
    } catch (e) {
      return res.status(200).json({ ok: true, learned: 0, profileUpdated: false, reason: 'Unparseable response' });
    }

    const newFacts = Array.isArray(result.memories) ? result.memories : [];
    const updatedProfile = result.profile && typeof result.profile === 'object' ? result.profile : profile;

    // --- Save updated profile ---
    updatedProfile._lastUpdated = new Date().toISOString();
    await redis(['SET', PROFILE_KEY, JSON.stringify(updatedProfile)]);

    // --- Deduplicate and save new memories ---
    const existingLower = existing.map(m => m.text.toLowerCase());
    const genuinelyNew = newFacts.filter(f => {
      if (!f.text || typeof f.text !== 'string' || f.text.length < 5) return false;
      const lower = f.text.toLowerCase();
      return !existingLower.some(e =>
        e.includes(lower) || lower.includes(e) ||
        similarity(e, lower) > 0.85
      );
    });

    let updated = [...existing];
    for (const fact of genuinelyNew) {
      updated.push({
        id: Date.now() + Math.random(),
        text: fact.text.slice(0, 500),
        category: fact.category || 'general',
        ts: Date.now(),
        auto: true
      });
    }

    // --- Memory consolidation ---
    let consolidated = false;
    if (updated.length > CONSOLIDATION_THRESHOLD) {
      updated = consolidateMemories(updated);
      consolidated = true;
    }

    // Trim to max
    while (updated.length > MAX_MEMORIES) updated.shift();

    await redis(['SET', MEMORY_KEY, JSON.stringify(updated)]);

    return res.status(200).json({
      ok: true,
      learned: genuinelyNew.length,
      facts: genuinelyNew.map(f => f.text),
      profileUpdated: true,
      consolidated,
      totalMemories: updated.length
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// Simple string similarity (Jaccard on word sets)
function similarity(a, b) {
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  let intersection = 0;
  for (const w of wordsA) { if (wordsB.has(w)) intersection++; }
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Consolidate old memories: group by category, merge old ones into summaries
function consolidateMemories(memories) {
  // Sort by timestamp (newest last)
  memories.sort((a, b) => (a.ts || 0) - (b.ts || 0));

  // Keep newest 100 as individual memories
  const keepCount = 100;
  const toKeep = memories.slice(-keepCount);
  const toConsolidate = memories.slice(0, -keepCount);

  if (toConsolidate.length < 10) return memories; // Not worth consolidating

  // Group old memories by category
  const groups = {};
  for (const m of toConsolidate) {
    const cat = m.category || 'general';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(m.text);
  }

  // Create one consolidated memory per category
  const summaries = [];
  for (const [cat, texts] of Object.entries(groups)) {
    // Deduplicate within category
    const unique = [...new Set(texts)];
    summaries.push({
      id: Date.now() + Math.random(),
      text: '[CONSOLIDATED] ' + unique.join(' | '),
      category: cat,
      ts: Date.now(),
      consolidated: true,
      sourceCount: unique.length
    });
  }

  return [...summaries, ...toKeep];
}

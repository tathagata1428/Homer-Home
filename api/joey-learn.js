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
  const MAX_MEMORIES = 200;

  async function redis(cmd) {
    const r = await fetch(REDIS_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN },
      body: JSON.stringify(cmd)
    });
    return r.json();
  }

  try {
    // Load existing memories so the model knows what's already stored
    const memResult = await redis(['GET', MEMORY_KEY]);
    const existing = memResult.result ? JSON.parse(memResult.result) : [];
    const existingText = existing.length
      ? existing.map(m => '- [' + m.category + '] ' + m.text).join('\n')
      : '(none yet)';

    // Ask the LLM to extract new facts
    const extractPrompt = `You are a memory extraction system. Analyze this conversation and extract NEW facts about the user that are worth remembering permanently.

EXISTING MEMORIES (do NOT duplicate these):
${existingText}

RULES:
- Only extract facts NOT already in existing memories
- Focus on: personal info, preferences, people, dates, goals, lessons, wins, habits, opinions
- Skip: small talk, greetings, temporary/trivial things, things the assistant said (only remember user facts)
- Each memory should be a concise, standalone fact
- Return ONLY valid JSON array, nothing else
- If nothing new worth remembering, return []

FORMAT (return ONLY this JSON, no markdown, no explanation):
[{"text": "fact about the user", "category": "preference|fact|person|event|lesson|win|goal|habit"}]`;

    // Only send last 6 messages (3 exchanges) to keep it focused
    const recentMsgs = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-6);

    const headers = { 'Content-Type': 'application/json' };
    if (GATEWAY_TOKEN) headers['Authorization'] = 'Bearer ' + GATEWAY_TOKEN;

    const llmRes = await fetch(GATEWAY_URL + '/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: extractPrompt },
          ...recentMsgs,
          { role: 'user', content: 'Extract new memories from the conversation above. Return JSON array only.' }
        ],
        temperature: 0.1,
        max_tokens: 500
      })
    });

    if (!llmRes.ok) {
      return res.status(502).json({ error: 'LLM extraction failed' });
    }

    const llmData = await llmRes.json();
    const rawContent = (llmData.choices && llmData.choices[0] && llmData.choices[0].message && llmData.choices[0].message.content) || '[]';

    // Parse the extracted memories — handle markdown-wrapped JSON
    let newFacts = [];
    try {
      // Strip markdown code fences if present
      let cleaned = rawContent.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }
      newFacts = JSON.parse(cleaned);
      if (!Array.isArray(newFacts)) newFacts = [];
    } catch (e) {
      return res.status(200).json({ ok: true, learned: 0, reason: 'No parseable facts' });
    }

    if (!newFacts.length) {
      return res.status(200).json({ ok: true, learned: 0 });
    }

    // Deduplicate against existing memories (fuzzy check)
    const existingLower = existing.map(m => m.text.toLowerCase());
    const genuinelyNew = newFacts.filter(f => {
      if (!f.text || typeof f.text !== 'string') return false;
      const lower = f.text.toLowerCase();
      // Skip if very similar to an existing memory
      return !existingLower.some(e => e.includes(lower) || lower.includes(e));
    });

    if (!genuinelyNew.length) {
      return res.status(200).json({ ok: true, learned: 0, reason: 'All facts already known' });
    }

    // Add new memories
    const updated = [...existing];
    for (const fact of genuinelyNew) {
      updated.push({
        id: Date.now() + Math.random(),
        text: fact.text.slice(0, 500),
        category: fact.category || 'general',
        ts: Date.now(),
        auto: true // flag as auto-extracted
      });
    }

    // Trim to max
    while (updated.length > MAX_MEMORIES) updated.shift();

    await redis(['SET', MEMORY_KEY, JSON.stringify(updated)]);

    return res.status(200).json({
      ok: true,
      learned: genuinelyNew.length,
      facts: genuinelyNew.map(f => f.text),
      totalMemories: updated.length
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

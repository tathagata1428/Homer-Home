export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // --- Auth ---
  const { messages, passphrase } = req.body || {};
  if (!passphrase) return res.status(401).json({ error: 'Missing passphrase' });

  const ADMIN_HASH = (process.env.HOMER_ADMIN_HASH || '').trim();
  if (!ADMIN_HASH) return res.status(500).json({ error: 'Server not configured (HOMER_ADMIN_HASH)' });
  if (passphrase.trim() !== ADMIN_HASH) return res.status(403).json({ error: 'Forbidden' });

  if (!messages || !Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  // --- Config ---
  const GATEWAY_URL = (process.env.OC_GATEWAY_URL || 'http://localhost:18789').replace(/\/+$/, '');
  const GATEWAY_TOKEN = process.env.OC_GATEWAY_TOKEN || '';
  const MODEL = process.env.OC_MODEL || 'llama-3.3-70b-versatile';
  const JOEY_CONTEXT = process.env.JOEY_CONTEXT || '';

  // --- Load all context from Redis in parallel ---
  let memoriesText = '';
  let profileText = '';
  let historyMessages = [];

  try {
    const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (REDIS_URL && REDIS_TOKEN) {
      const redisFetch = (cmd) => fetch(REDIS_URL, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN },
        body: JSON.stringify(cmd)
      }).then(r => r.json());

      // Fetch all three in parallel
      const [memRes, profileRes, histRes] = await Promise.all([
        redisFetch(['GET', 'joey:memories']),
        redisFetch(['GET', 'joey:profile']),
        redisFetch(['GET', 'joey:history'])
      ]);

      // --- TIER 1: User Profile (always injected, highest priority) ---
      if (profileRes.result) {
        try {
          const profile = JSON.parse(profileRes.result);
          const fields = [];
          if (profile.name) fields.push('Name: ' + profile.name);
          if (profile.nickname) fields.push('Preferred name: ' + profile.nickname);
          if (profile.location) fields.push('Location: ' + profile.location);
          if (profile.timezone) fields.push('Timezone: ' + profile.timezone);
          if (profile.profession) fields.push('Profession: ' + profile.profession);
          if (profile.communication_style) fields.push('Communication style: ' + profile.communication_style);
          if (profile.current_mood) fields.push('Recent mood: ' + profile.current_mood);
          if (profile.languages) fields.push('Languages: ' + (Array.isArray(profile.languages) ? profile.languages.join(', ') : profile.languages));
          if (profile.interests) fields.push('Interests: ' + (Array.isArray(profile.interests) ? profile.interests.join(', ') : profile.interests));

          // People
          if (profile.people && typeof profile.people === 'object') {
            const ppl = Array.isArray(profile.people)
              ? profile.people.map(p => (p.name || p) + (p.relationship ? ' (' + p.relationship + ')' : ''))
              : Object.entries(profile.people).map(([k, v]) => k + ' (' + v + ')');
            if (ppl.length) fields.push('People: ' + ppl.join(', '));
          }

          // Active goals
          if (profile.active_goals && Array.isArray(profile.active_goals) && profile.active_goals.length) {
            fields.push('Active goals: ' + profile.active_goals.join(', '));
          }

          // Recent topics
          if (profile.recent_topics && Array.isArray(profile.recent_topics) && profile.recent_topics.length) {
            fields.push('Recent topics: ' + profile.recent_topics.slice(-5).join(', '));
          }

          // Important dates
          if (profile.important_dates && typeof profile.important_dates === 'object') {
            const dates = Array.isArray(profile.important_dates)
              ? profile.important_dates.map(d => (d.label || d.event || '') + ': ' + (d.date || ''))
              : Object.entries(profile.important_dates).map(([k, v]) => k + ': ' + v);
            if (dates.length) fields.push('Important dates: ' + dates.join(', '));
          }

          if (fields.length) {
            profileText = '\n\n=== WHO YOU ARE TALKING TO ===\n' + fields.join('\n');
          }
        } catch (e) { /* malformed profile */ }
      }

      // --- TIER 2: Memories (organized by category) ---
      if (memRes.result) {
        const mems = JSON.parse(memRes.result);
        if (mems.length) {
          // Group by category for cleaner injection
          const groups = {};
          for (const m of mems) {
            const cat = m.category || 'general';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(m.text);
          }

          let memLines = [];
          for (const [cat, texts] of Object.entries(groups)) {
            memLines.push('[' + cat.toUpperCase() + ']');
            for (const t of texts) memLines.push('  - ' + t);
          }
          memoriesText = '\n\n=== YOUR MEMORIES ABOUT THIS PERSON ===\n' + memLines.join('\n');
        }
      }

      // --- TIER 3: Conversation history (backfill for continuity) ---
      if (histRes.result) {
        historyMessages = JSON.parse(histRes.result);
      }
    }
  } catch (e) { /* context unavailable — proceed without */ }

  // --- Build the system prompt ---
  // Layer: personality → profile → memories → instructions
  const systemParts = [];
  if (JOEY_CONTEXT) systemParts.push(JOEY_CONTEXT);
  if (profileText) systemParts.push(profileText);
  if (memoriesText) systemParts.push(memoriesText);

  // Add meta-instructions for personalization
  systemParts.push(`
=== PERSONALIZATION INSTRUCTIONS ===
- You have a profile and memories about this person. USE THEM NATURALLY.
- Reference things you know: ask about their goals, mention their people by name, recall past conversations.
- Adapt your tone to their communication_style and current_mood.
- If they seem stressed, be supportive. If they're in a good mood, match their energy.
- Don't announce "I remember that..." — just naturally use what you know, like a real friend would.
- Track the time: it's currently ${new Date().toISOString()}. Greet appropriately (morning/afternoon/evening) for their timezone.
- If they mention something new about themselves, you'll automatically remember it (your memory system handles this).
- Build on previous conversations — reference what you discussed before when relevant.`);

  const systemContent = systemParts.join('\n').trim();

  // --- Merge history with client messages ---
  const clientUserMsgs = messages.filter(m => m.role === 'user').map(m => m.content);
  const backfillMessages = historyMessages.filter(m => {
    if (m.role === 'user') return !clientUserMsgs.includes(m.content);
    return true;
  }).slice(-20);

  // Final message order: system → backfill history → client messages
  const finalMessages = [];
  if (systemContent) finalMessages.push({ role: 'system', content: systemContent });
  if (backfillMessages.length) {
    finalMessages.push({ role: 'system', content: '--- Previous conversation (for continuity) ---' });
    finalMessages.push(...backfillMessages);
    finalMessages.push({ role: 'system', content: '--- Current conversation ---' });
  }
  finalMessages.push(...messages);

  const headers = { 'Content-Type': 'application/json' };
  if (GATEWAY_TOKEN) headers['Authorization'] = 'Bearer ' + GATEWAY_TOKEN;

  try {
    const upstream = await fetch(GATEWAY_URL + '/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: MODEL,
        messages: finalMessages,
        stream: true
      })
    });

    if (!upstream.ok) {
      const errBody = await upstream.text().catch(() => upstream.statusText);
      return res.status(upstream.status).send(errBody);
    }

    // Stream SSE back to client
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
    } catch (streamErr) {
      // Client disconnected or upstream closed
    }

    res.end();

  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({
        error: 'Cannot reach gateway',
        detail: err.message
      });
    }
  }
}

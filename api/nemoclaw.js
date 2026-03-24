// NemoClaw - Nemotron-3-Super via Ollama Cloud
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

  // --- Redis setup for auth and context ---
  const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  const redisFetch = (cmd) => fetch(REDIS_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN },
    body: JSON.stringify(cmd)
  }).then(r => r.json());

  // Verify passphrase against admin hash or user database
  async function verifyPassphrase(pass) {
    const ADMIN_HASH = (process.env.HOMER_ADMIN_HASH || '').trim();
    if (ADMIN_HASH && pass.trim() === ADMIN_HASH) return true;

    const usersData = await redisFetch(['GET', 'homer:users']);
    if (usersData.result) {
      try {
        const users = JSON.parse(usersData.result);
        for (const user of users) {
          if (user.passwordHash === pass.trim()) return true;
        }
      } catch (e) {}
    }
    return false;
  }

  const isValid = await verifyPassphrase(passphrase);
  if (!isValid) return res.status(403).json({ error: 'Forbidden' });

  if (!messages || !Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  // --- NemoClaw Config ---
  const GATEWAY_URL = (process.env.NEMOCLAW_GATEWAY_URL || 'http://localhost:11434').replace(/\/+$/, '');
  const GATEWAY_TOKEN = process.env.NEMOCLAW_GATEWAY_TOKEN || '';
  const MODEL = process.env.NEMOCLAW_MODEL || 'nemotron-3-super:cloud';
  const BRAVE_KEY = (process.env.BRAVE_SEARCH_API_KEY || '').trim();

  // --- Load all context from Redis in parallel (shared with Joey) ---
  let memoriesText = '';
  let profileText = '';
  let historyMessages = [];

  try {

      const [memRes, profileRes, histRes] = await Promise.all([
        redisFetch(['GET', 'joey:memories']),
        redisFetch(['GET', 'joey:profile']),
        redisFetch(['GET', 'joey:history'])
      ]);

      // --- User Profile ---
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

          if (profile.people && typeof profile.people === 'object') {
            const ppl = Array.isArray(profile.people)
              ? profile.people.map(p => (p.name || p) + (p.relationship ? ' (' + p.relationship + ')' : ''))
              : Object.entries(profile.people).map(([k, v]) => k + ' (' + v + ')');
            if (ppl.length) fields.push('People: ' + ppl.join(', '));
          }

          if (profile.active_goals && Array.isArray(profile.active_goals) && profile.active_goals.length) {
            fields.push('Active goals: ' + profile.active_goals.join(', '));
          }

          if (profile.recent_topics && Array.isArray(profile.recent_topics) && profile.recent_topics.length) {
            fields.push('Recent topics: ' + profile.recent_topics.slice(-5).join(', '));
          }

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

      // --- Memories ---
      if (memRes.result) {
        const mems = JSON.parse(memRes.result);
        if (mems.length) {
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

      // --- Conversation history ---
      if (histRes.result) {
        historyMessages = JSON.parse(histRes.result);
      }
  } catch (e) { /* context unavailable — proceed without */ }

  // --- Web search for current information ---
  let searchContext = '';
  if (BRAVE_KEY) {
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
    const rawQuery = (lastUserMsg && lastUserMsg.content) || '';
    const userQuery = rawQuery.replace(/\[Attached files for analysis\][\s\S]*?--- end ---\n*/g, '').trim().slice(0, 200);
    const needsSearch = /\b(search|find|look up|what('s| is| are)|who is|when is|where is|how (to|do|does|can|much)|latest|news|events?|weather|price|score|results?|happening|schedule|review|recommend|best|top \d|near me|today|tonight|this week|upcoming|current|recent|2025|2026)\b/i.test(userQuery) && userQuery.length > 10;
    if (needsSearch) {
      try {
        const searchUrl = 'https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(userQuery) + '&count=5';
        const searchResp = await fetch(searchUrl, {
          headers: { 'Accept': 'application/json', 'X-Subscription-Token': BRAVE_KEY }
        });
        if (searchResp.ok) {
          const searchData = await searchResp.json();
          if (searchData.web && searchData.web.results && searchData.web.results.length) {
            const snippets = searchData.web.results.slice(0, 5).map((r, i) =>
              (i + 1) + '. ' + (r.title || '') + '\n   ' + (r.description || '') + '\n   Source: ' + (r.url || '')
            );
            searchContext = '\n\n=== WEB SEARCH RESULTS (live) ===\nQuery: "' + userQuery.slice(0, 100) + '"\n' + snippets.join('\n') + '\n\nUse these results to give accurate, up-to-date answers. Cite sources when helpful.';
          }
          if (searchData.infobox) {
            searchContext += '\n\nKnowledge panel: ' + (searchData.infobox.title || '') + ' — ' + (searchData.infobox.description || '');
          }
        }
      } catch (e) { /* search failed, proceed without */ }
    }
  }

  // --- Build system prompt (same Joey persona as openclaw) ---
  const JOEY_CONTEXT = process.env.JOEY_CONTEXT || '';
  const systemParts = [];
  if (JOEY_CONTEXT) systemParts.push(JOEY_CONTEXT);
  if (profileText) systemParts.push(profileText);
  if (memoriesText) systemParts.push(memoriesText);
  if (searchContext) systemParts.push(searchContext);

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
    const chatUrl = GATEWAY_URL.endsWith('/v1') ? GATEWAY_URL + '/chat/completions' : GATEWAY_URL + '/v1/chat/completions';
    const upstream = await fetch(chatUrl, {
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
        error: 'Cannot reach NemoClaw gateway',
        detail: err.message
      });
    }
  }
}

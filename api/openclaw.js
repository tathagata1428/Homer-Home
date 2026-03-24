export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, passphrase } = req.body || {};
  if (!passphrase) return res.status(401).json({ error: 'Missing passphrase' });

  const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  const redisFetch = (cmd) => fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN },
    body: JSON.stringify(cmd)
  }).then((r) => r.json());

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

  const GATEWAY_URL = (process.env.OC_GATEWAY_URL || 'http://localhost:18789').replace(/\/+$/, '');
  const GATEWAY_TOKEN = process.env.OC_GATEWAY_TOKEN || '';
  const MODEL = process.env.OC_MODEL || 'llama-3.3-70b-versatile';
  const JOEY_CONTEXT = process.env.JOEY_CONTEXT || '';
  const BRAVE_KEY = (process.env.BRAVE_SEARCH_API_KEY || '').trim();
  const TAVILY_KEY = (process.env.TAVILY_API_KEY || '').trim();

  function sanitizeUserQuery(raw) {
    return String(raw || '')
      .replace(/\[Attached files for analysis\][\s\S]*?--- end ---\n*/g, '')
      .replace(/\[FORCE_WEB_SEARCH\]\s*/gi, '')
      .replace(/^(search for|search|look up|find)\s*:?\s*/i, '')
      .trim()
      .slice(0, 240);
  }

  function isWebSearchIntent(query) {
    if (!query || query.length < 8) return false;
    return /\b(search|find|look up|what('s| is| are| was| were)?|who('?s| is| was)?|when|where|how|latest|news|events?|weather|price|stock|market|score|results?|happening|schedule|review|recommend|best|top \d|near me|today|tonight|tomorrow|this week|upcoming|current|recent|update|updates|2025|2026)\b/i.test(query);
  }

  let memoriesText = '';
  let profileText = '';
  let historyMessages = [];

  try {
    const [memRes, profileRes, histRes] = await Promise.all([
      redisFetch(['GET', 'joey:memories']),
      redisFetch(['GET', 'joey:profile']),
      redisFetch(['GET', 'joey:history'])
    ]);

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
            ? profile.people.map((p) => (p.name || p) + (p.relationship ? ' (' + p.relationship + ')' : ''))
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
            ? profile.important_dates.map((d) => (d.label || d.event || '') + ': ' + (d.date || ''))
            : Object.entries(profile.important_dates).map(([k, v]) => k + ': ' + v);
          if (dates.length) fields.push('Important dates: ' + dates.join(', '));
        }

        if (fields.length) {
          profileText = '\n\n=== WHO YOU ARE TALKING TO ===\n' + fields.join('\n');
        }
      } catch (e) {}
    }

    if (memRes.result) {
      const mems = JSON.parse(memRes.result);
      if (mems.length) {
        const groups = {};
        for (const m of mems) {
          const cat = m.category || 'general';
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(m.text);
        }

        const memLines = [];
        for (const [cat, texts] of Object.entries(groups)) {
          memLines.push('[' + cat.toUpperCase() + ']');
          for (const t of texts) memLines.push('  - ' + t);
        }
        memoriesText = '\n\n=== YOUR MEMORIES ABOUT THIS PERSON ===\n' + memLines.join('\n');
      }
    }

    if (histRes.result) {
      historyMessages = JSON.parse(histRes.result);
    }
  } catch (e) {}

  let searchContext = '';
  let searchState = 'not-needed';
  let searchProvider = 'none';
  const lastUserMsg = messages.filter((m) => m.role === 'user').pop();
  const rawLastUserContent = String((lastUserMsg && lastUserMsg.content) || '');
  const forceWebSearch = /\[FORCE_WEB_SEARCH\]/i.test(rawLastUserContent);
  const userQuery = sanitizeUserQuery(rawLastUserContent);
  const needsSearch = forceWebSearch || isWebSearchIntent(userQuery);

  if (needsSearch) {
    searchState = (BRAVE_KEY || TAVILY_KEY) ? 'attempted' : 'unavailable';
  }

  if (needsSearch && BRAVE_KEY) {
    try {
      const searchUrl = 'https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(userQuery) + '&count=6&text_decorations=false';
      const searchResp = await fetch(searchUrl, {
        headers: { Accept: 'application/json', 'X-Subscription-Token': BRAVE_KEY }
      });

      if (searchResp.ok) {
        const searchData = await searchResp.json();
        if (searchData.web && searchData.web.results && searchData.web.results.length) {
          const snippets = searchData.web.results.slice(0, 6).map((r, i) =>
            (i + 1) + '. ' + (r.title || '') + '\n   ' + (r.description || '') + '\n   Source: ' + (r.url || '')
          );
          searchContext = '\n\n=== WEB SEARCH RESULTS (live) ===\nQuery: "' + userQuery.slice(0, 120) + '"\n' + snippets.join('\n') + '\n\nUse these results for any time-sensitive claim. Cite the source names naturally and prefer saying you are unsure over filling gaps.';
          searchState = 'results';
          searchProvider = 'brave';
        } else {
          searchState = 'empty';
        }

        if (searchData.infobox) {
          searchContext += '\n\nKnowledge panel: ' + (searchData.infobox.title || '') + ' - ' + (searchData.infobox.description || '');
        }
      } else {
        searchState = 'failed';
      }
    } catch (e) {
      searchState = 'failed';
    }
  }

  if (needsSearch && searchState !== 'results' && TAVILY_KEY) {
    try {
      const looksNewsy = /\b(latest|news|today|tonight|tomorrow|recent|current|update|updates|happening)\b/i.test(userQuery);
      const tavilyResp = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + TAVILY_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: userQuery,
          topic: looksNewsy ? 'news' : 'general',
          search_depth: 'basic',
          max_results: 6,
          include_answer: false,
          include_raw_content: false
        })
      });

      if (tavilyResp.ok) {
        const tavilyData = await tavilyResp.json();
        if (Array.isArray(tavilyData.results) && tavilyData.results.length) {
          const snippets = tavilyData.results.slice(0, 6).map((r, i) =>
            (i + 1) + '. ' + (r.title || '') + '\n   ' + (r.content || '') + '\n   Source: ' + (r.url || '')
          );
          searchContext = '\n\n=== WEB SEARCH RESULTS (live) ===\nQuery: "' + userQuery.slice(0, 120) + '"\n' + snippets.join('\n') + '\n\nUse these results for any time-sensitive claim. Cite the source names naturally and prefer saying you are unsure over filling gaps.';
          searchState = 'results';
          searchProvider = 'tavily';
        } else if (searchState !== 'results') {
          searchState = 'empty';
        }
      } else if (searchState !== 'results') {
        searchState = 'failed';
      }
    } catch (e) {
      if (searchState !== 'results') searchState = 'failed';
    }
  }

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
- Don't announce "I remember that..." - just naturally use what you know, like a real friend would.
- Track the time: it's currently ${new Date().toISOString()}. Greet appropriately (morning/afternoon/evening) for their timezone.
- If they mention something new about themselves, you'll automatically remember it (your memory system handles this).
- Build on previous conversations - reference what you discussed before when relevant.`);

  systemParts.push(`
=== WEB RELIABILITY RULES ===
- For current events, recent news, live prices, schedules, reviews, rankings, or anything that depends on the web right now, do not answer from memory alone.
- Search status for this turn: ${searchState}.
- Search provider for this turn: ${searchProvider}.
- Forced live search mode: ${forceWebSearch ? 'yes' : 'no'}.
- If search status is "results", ground the answer in the provided WEB SEARCH RESULTS and cite source names or domains naturally.
- If search status is not "results" but the user is asking for current or web-dependent information, say plainly that you couldn't verify it live right now and ask the user to retry. Do not guess, invent sources, or act certain.
- If the user explicitly asks you to search, treat that as a requirement for live verification.`);

  if (needsSearch) {
    systemParts.push(`
=== SEARCH-GROUNDED ANSWER MODE ===
- This turn requires a web-grounded answer.
- Use only the WEB SEARCH RESULTS for factual claims.
- Do not answer from model memory, prior beliefs, or unstated assumptions.
- If the results are incomplete or conflicting, say that clearly.
- Include a short "Sources:" line at the end with the source domains or titles you relied on.
- If search status is not "results", reply that live verification failed and do not provide the requested facts anyway.`);
  }

  const systemContent = systemParts.join('\n').trim();

  const clientUserMsgs = messages.filter((m) => m.role === 'user').map((m) => m.content);
  const backfillMessages = historyMessages.filter((m) => {
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
  if (GATEWAY_TOKEN) headers.Authorization = 'Bearer ' + GATEWAY_TOKEN;
  res.setHeader('X-OpenClaw-Search-State', searchState);
  res.setHeader('X-OpenClaw-Search-Provider', searchProvider);

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
    } catch (streamErr) {}

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

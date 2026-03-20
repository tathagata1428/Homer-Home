export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // --- Auth: passphrase is already SHA-256 hex from client (homer-sync-pass) ---
  const { messages, passphrase } = req.body || {};
  if (!passphrase) return res.status(401).json({ error: 'Missing passphrase' });

  const ADMIN_HASH = (process.env.HOMER_ADMIN_HASH || '').trim();
  if (!ADMIN_HASH) return res.status(500).json({ error: 'Server not configured (HOMER_ADMIN_HASH)' });

  if (passphrase.trim() !== ADMIN_HASH) return res.status(403).json({ error: 'Forbidden' });

  if (!messages || !Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  // --- Forward to LLM provider (Groq / OpenClaw / any OpenAI-compatible API) ---
  const GATEWAY_URL = (process.env.OC_GATEWAY_URL || 'http://localhost:18789').replace(/\/+$/, '');
  const GATEWAY_TOKEN = process.env.OC_GATEWAY_TOKEN || '';
  const MODEL = process.env.OC_MODEL || 'llama-3.3-70b-versatile';
  const JOEY_CONTEXT = process.env.JOEY_CONTEXT || '';

  // Fetch Joey's learned memories + conversation history from Redis
  let memoriesText = '';
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

      // Fetch memories and history in parallel
      const [memRes, histRes] = await Promise.all([
        redisFetch(['GET', 'joey:memories']),
        redisFetch(['GET', 'joey:history'])
      ]);

      // Parse memories
      if (memRes.result) {
        const mems = JSON.parse(memRes.result);
        if (mems.length) {
          memoriesText = '\n\nYOUR LEARNED MEMORIES (things you chose to remember):\n' +
            mems.map(m => '- [' + m.category + '] ' + m.text).join('\n');
        }
      }

      // Parse conversation history (used to fill in context the client didn't send)
      if (histRes.result) {
        historyMessages = JSON.parse(histRes.result);
      }
    }
  } catch (e) { /* memories/history unavailable — proceed without */ }

  // Build system context: base personality + learned memories
  const systemContent = (JOEY_CONTEXT + memoriesText).trim();

  // Merge history with client messages:
  // - Client sends recent messages (may be incomplete on new session)
  // - Redis has last 50 messages from previous sessions
  // - Use Redis history as backfill for older context
  const clientUserMsgs = messages.filter(m => m.role === 'user').map(m => m.content);
  const backfillMessages = historyMessages.filter(m => {
    // Only include history messages not already in the client's payload
    if (m.role === 'user') return !clientUserMsgs.includes(m.content);
    return true;
  }).slice(-20); // Max 20 backfill messages (10 exchanges)

  // Final message order: system → backfill history → client messages
  const finalMessages = [];
  if (systemContent) finalMessages.push({ role: 'system', content: systemContent });
  if (backfillMessages.length) {
    finalMessages.push({ role: 'system', content: '--- RECENT CONVERSATION HISTORY (from previous sessions) ---' });
    finalMessages.push(...backfillMessages);
    finalMessages.push({ role: 'system', content: '--- END HISTORY --- Now responding to the current conversation:' });
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
        error: 'Cannot reach OpenClaw gateway',
        detail: err.message
      });
    }
  }
}

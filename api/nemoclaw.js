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

  const ADMIN_HASH = (process.env.HOMER_ADMIN_HASH || '').trim();
  if (!ADMIN_HASH) return res.status(500).json({ error: 'Server not configured (HOMER_ADMIN_HASH)' });
  if (passphrase.trim() !== ADMIN_HASH) return res.status(403).json({ error: 'Forbidden' });

  if (!messages || !Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  // --- NemoClaw Config ---
  const GATEWAY_URL = (process.env.NEMOCLAW_GATEWAY_URL || 'http://localhost:11434').replace(/\/+$/, '');
  const GATEWAY_TOKEN = process.env.NEMOCLAW_GATEWAY_TOKEN || '';
  const MODEL = process.env.NEMOCLAW_MODEL || 'nemotron-3-super:cloud';

  // --- Build system prompt (lightweight — no Joey persona) ---
  const systemParts = [];
  systemParts.push(`You are NemoClaw, a helpful AI assistant powered by NVIDIA Nemotron-3-Super. You are knowledgeable, precise, and friendly. Current time: ${new Date().toISOString()}.`);

  const finalMessages = [];
  finalMessages.push({ role: 'system', content: systemParts.join('\n') });
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

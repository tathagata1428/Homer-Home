export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth
  const passphrase = req.method === 'GET' ? req.query.passphrase : (req.body || {}).passphrase;
  if (!passphrase) return res.status(401).json({ error: 'Missing passphrase' });
  const ADMIN_HASH = (process.env.HOMER_ADMIN_HASH || '').trim();
  if (!ADMIN_HASH || passphrase.trim() !== ADMIN_HASH) return res.status(403).json({ error: 'Forbidden' });

  // Redis
  const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(500).json({ error: 'Redis not configured' });

  const HISTORY_KEY = 'joey:history';
  const MAX_MESSAGES = 50; // Keep last 50 messages (25 exchanges)

  async function redis(cmd) {
    const r = await fetch(REDIS_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN },
      body: JSON.stringify(cmd)
    });
    return r.json();
  }

  try {
    // GET — return conversation history
    if (req.method === 'GET') {
      const result = await redis(['GET', HISTORY_KEY]);
      const history = result.result ? JSON.parse(result.result) : [];
      return res.status(200).json({ history });
    }

    // POST — save conversation history
    if (req.method === 'POST') {
      const { messages } = req.body || {};
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Missing messages array' });
      }

      // Only keep role + content, strip system messages, trim to max
      const cleaned = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: (m.content || '').slice(0, 2000) }))
        .slice(-MAX_MESSAGES);

      await redis(['SET', HISTORY_KEY, JSON.stringify(cleaned)]);
      return res.status(200).json({ ok: true, count: cleaned.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

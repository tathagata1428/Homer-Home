export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth
  const passphrase = req.method === 'GET' ? req.query.passphrase : (req.body || {}).passphrase;
  if (!passphrase) return res.status(401).json({ error: 'Missing passphrase' });
  const ADMIN_HASH = (process.env.HOMER_ADMIN_HASH || '').trim();
  if (!ADMIN_HASH || passphrase.trim() !== ADMIN_HASH) return res.status(403).json({ error: 'Forbidden' });

  // Redis
  var REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  var REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
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
    // GET — return all memories
    if (req.method === 'GET') {
      const result = await redis(['GET', MEMORY_KEY]);
      const memories = result.result ? JSON.parse(result.result) : [];
      return res.status(200).json({ memories });
    }

    // POST — add a memory
    if (req.method === 'POST') {
      const { memory, category } = req.body || {};
      if (!memory) return res.status(400).json({ error: 'Missing memory' });

      const result = await redis(['GET', MEMORY_KEY]);
      const memories = result.result ? JSON.parse(result.result) : [];

      memories.push({
        id: Date.now(),
        text: memory,
        category: category || 'general',
        ts: Date.now()
      });

      // Trim to max
      while (memories.length > MAX_MEMORIES) memories.shift();

      await redis(['SET', MEMORY_KEY, JSON.stringify(memories)]);
      return res.status(200).json({ ok: true, count: memories.length });
    }

    // DELETE — remove a memory by id or text match
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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

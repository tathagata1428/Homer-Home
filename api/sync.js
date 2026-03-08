import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  var REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  function hashKey(passphrase) {
    return 'homer:' + crypto.createHash('sha256').update(passphrase).digest('hex');
  }

  async function redis(cmd) {
    var r = await fetch(REDIS_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN },
      body: JSON.stringify(cmd)
    });
    return r.json();
  }

  try {
    if (req.method === 'GET') {
      var key = req.query.key;
      if (!key) return res.status(400).json({ error: 'Missing key' });

      var result = await redis(['GET', hashKey(key)]);
      if (!result.result) {
        return res.status(404).json({ error: 'No backup found for this passphrase' });
      }

      return res.status(200).json({ data: JSON.parse(result.result) });
    }

    if (req.method === 'POST') {
      var body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body.key || !body.data) return res.status(400).json({ error: 'Missing key or data' });

      await redis(['SET', hashKey(body.key), JSON.stringify(body.data)]);

      return res.status(200).json({ ok: true, ts: Date.now() });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}

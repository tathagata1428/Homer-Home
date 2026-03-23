// Google Drive context backup — fetches Joey context from Redis, POSTs to Google Apps Script
export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // --- Auth ---
  const { passphrase } = req.body || {};
  if (!passphrase) return res.status(401).json({ error: 'Missing passphrase' });

  const ADMIN_HASH = (process.env.HOMER_ADMIN_HASH || '').trim();
  if (!ADMIN_HASH) return res.status(500).json({ error: 'Server not configured' });
  if (passphrase.trim() !== ADMIN_HASH) return res.status(403).json({ error: 'Forbidden' });

  // --- Google Apps Script webhook ---
  const GDRIVE_WEBHOOK = (process.env.GDRIVE_WEBHOOK_URL || '').trim();
  const GDRIVE_SECRET = (process.env.GDRIVE_SECRET || '').trim();
  if (!GDRIVE_WEBHOOK) return res.status(500).json({ error: 'GDRIVE_WEBHOOK_URL not configured' });

  // --- Load context from Redis ---
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

  try {
    const [memRes, profileRes, histRes] = await Promise.all([
      redisFetch(['GET', 'joey:memories']),
      redisFetch(['GET', 'joey:profile']),
      redisFetch(['GET', 'joey:history'])
    ]);

    const payload = {
      secret: GDRIVE_SECRET,
      profile: profileRes.result ? JSON.parse(profileRes.result) : null,
      memories: memRes.result ? JSON.parse(memRes.result) : [],
      history: histRes.result ? JSON.parse(histRes.result) : []
    };

    // POST to Google Apps Script
    const gRes = await fetch(GDRIVE_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const gData = await gRes.text();
    let parsed;
    try { parsed = JSON.parse(gData); } catch { parsed = { raw: gData }; }

    if (!gRes.ok) {
      return res.status(502).json({ error: 'Google Script error', status: gRes.status, detail: parsed });
    }

    return res.status(200).json({ ok: true, drive: parsed });

  } catch (err) {
    return res.status(500).json({ error: 'Backup failed', detail: err.message });
  }
}

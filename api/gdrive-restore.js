// Google Drive context restore — fetches Joey context from Google Apps Script, restores to Redis
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

  // --- Google Apps Script webhook ---
  const GDRIVE_WEBHOOK = (process.env.GDRIVE_WEBHOOK_URL || '').trim();
  const GDRIVE_SECRET = (process.env.GDRIVE_SECRET || '').trim();
  if (!GDRIVE_WEBHOOK) return res.status(500).json({ error: 'GDRIVE_WEBHOOK_URL not configured' });
  if (!GDRIVE_SECRET) return res.status(500).json({ error: 'GDRIVE_SECRET not configured' });

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

  try {
    // Verify authentication
    const isValid = await verifyPassphrase(passphrase);
    if (!isValid) return res.status(403).json({ error: 'Forbidden' });

    // Fetch latest context from Google Drive via Apps Script
    const restoreUrl = GDRIVE_WEBHOOK + '?action=restore&secret=' + encodeURIComponent(GDRIVE_SECRET);
    
    const gRes = await fetch(restoreUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const gData = await gRes.text();
    let parsed;
    try { parsed = JSON.parse(gData); } catch { parsed = { raw: gData }; }

    if (!gRes.ok || parsed.error) {
      return res.status(502).json({ 
        error: 'Google Script error', 
        status: gRes.status, 
        detail: parsed
      });
    }

    // Restore to Redis
    const { profile, memories, history } = parsed;
    const results = { profile: false, memories: false, history: false };

    if (profile !== undefined) {
      await redisFetch(['SET', 'joey:profile', JSON.stringify(profile || {})]);
      results.profile = true;
    }

    if (memories !== undefined) {
      await redisFetch(['SET', 'joey:memories', JSON.stringify(memories || [])]);
      results.memories = true;
    }

    if (history !== undefined) {
      await redisFetch(['SET', 'joey:history', JSON.stringify(history || [])]);
      results.history = true;
    }

    return res.status(200).json({ 
      ok: true, 
      restored: results,
      timestamp: parsed.exportedAt || null
    });

  } catch (err) {
    return res.status(500).json({ error: 'Restore failed', detail: err.message });
  }
}

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

  // --- Redis ---
  const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(500).json({ error: 'Redis not configured' });

  const redisFetch = (cmd) => fetch(REDIS_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN },
    body: JSON.stringify(cmd)
  }).then(r => r.json());

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
    const isValid = await verifyPassphrase(passphrase);
    if (!isValid) return res.status(403).json({ error: 'Forbidden' });

    // --- GET from Google Apps Script with manual redirect following ---
    const startUrl = GDRIVE_WEBHOOK + '?action=restore&secret=' + encodeURIComponent(GDRIVE_SECRET);
    let responseText = '';
    let finalStatus = 0;
    let redirectChain = [];

    let url = startUrl;
    for (let i = 0; i < 5; i++) {
      const resp = await fetch(url, { method: 'GET', redirect: 'manual' });
      redirectChain.push({ url: url.slice(0, 80), status: resp.status });

      if (resp.status >= 300 && resp.status < 400) {
        const location = resp.headers.get('location');
        if (!location) {
          return res.status(502).json({ error: 'Redirect without location', redirectChain });
        }
        url = location;
        continue;
      }

      finalStatus = resp.status;
      responseText = await resp.text();
      break;
    }

    if (!responseText) {
      return res.status(502).json({ error: 'No response after redirects', redirectChain });
    }

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const isHtml = responseText.trim().startsWith('<');
      return res.status(502).json({
        error: isHtml ? 'Google returned HTML — Apps Script may need redeployment' : 'Non-JSON response',
        status: finalStatus,
        responsePreview: responseText.slice(0, 300),
        redirectChain
      });
    }

    if (parsed.error) {
      return res.status(502).json({
        error: 'Google Script rejected the request',
        scriptError: parsed.error,
        hint: parsed.error === 'Unauthorized'
          ? 'GDRIVE_SECRET env var does not match the SECRET in your Google Apps Script.'
          : undefined,
        redirectChain
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

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

    const [memRes, profileRes, histRes] = await Promise.all([
      redisFetch(['GET', 'joey:memories']),
      redisFetch(['GET', 'joey:profile']),
      redisFetch(['GET', 'joey:history'])
    ]);

    // Trim history to last 30 messages to keep payload small
    let history = [];
    try { history = histRes.result ? JSON.parse(histRes.result) : []; } catch (e) {}
    if (history.length > 30) history = history.slice(-30);

    const payload = {
      secret: GDRIVE_SECRET,
      profile: profileRes.result ? JSON.parse(profileRes.result) : null,
      memories: memRes.result ? JSON.parse(memRes.result) : [],
      history
    };

    // --- POST to Google Apps Script with manual redirect following ---
    // Google Apps Script returns 302 redirects; we follow manually for reliability
    const bodyStr = JSON.stringify(payload);
    let responseText = '';
    let finalStatus = 0;
    let redirectChain = [];

    let url = GDRIVE_WEBHOOK;
    for (let i = 0; i < 5; i++) {
      const isPost = i === 0; // Only POST on first request, GET on redirects
      const fetchOpts = isPost
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: bodyStr, redirect: 'manual' }
        : { method: 'GET', redirect: 'manual' };

      const resp = await fetch(url, fetchOpts);
      redirectChain.push({ url: url.slice(0, 80), status: resp.status, method: isPost ? 'POST' : 'GET' });

      if (resp.status >= 300 && resp.status < 400) {
        const location = resp.headers.get('location');
        if (!location) {
          console.error('[gdrive-backup] Redirect without location at step ' + i, JSON.stringify(redirectChain));
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
      console.error('[gdrive-backup] No response after redirects', JSON.stringify(redirectChain));
      return res.status(502).json({ error: 'No response after redirects', redirectChain });
    }

    // Parse response
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Got HTML or non-JSON response — likely Google auth/error page
      const isHtml = responseText.trim().startsWith('<');
      console.error('[gdrive-backup] Non-JSON response, status=' + finalStatus + ', isHtml=' + isHtml + ', preview=' + responseText.slice(0, 200));
      console.error('[gdrive-backup] Redirect chain:', JSON.stringify(redirectChain));
      return res.status(502).json({
        error: isHtml ? 'Google returned HTML instead of JSON — the Apps Script may need redeployment' : 'Non-JSON response from Google',
        status: finalStatus,
        responsePreview: responseText.slice(0, 300),
        redirectChain
      });
    }

    // Check for script-level errors
    if (parsed.error) {
      console.error('[gdrive-backup] Script error:', parsed.error, JSON.stringify(redirectChain));
      return res.status(502).json({
        error: 'Google Script rejected the request',
        scriptError: parsed.error,
        hint: parsed.error === 'Unauthorized'
          ? 'GDRIVE_SECRET env var does not match the SECRET in your Google Apps Script. Check both values match exactly.'
          : undefined,
        redirectChain
      });
    }

    return res.status(200).json({ ok: true, drive: parsed });

  } catch (err) {
    console.error('[gdrive-backup] Exception:', err.message, err.stack);
    return res.status(500).json({ error: 'Backup failed', detail: err.message });
  }
}

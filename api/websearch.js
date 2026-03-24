// Web Search API — Brave Search with fallback
export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, passphrase, count } = req.body || {};
  if (!passphrase) return res.status(401).json({ error: 'Missing passphrase' });
  if (!query) return res.status(400).json({ error: 'Missing query' });

  // Redis auth
  const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(500).json({ error: 'Redis not configured' });

  const redisFetch = (cmd) => fetch(REDIS_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN },
    body: JSON.stringify(cmd)
  }).then(r => r.json());

  // Verify auth
  const ADMIN_HASH = (process.env.HOMER_ADMIN_HASH || '').trim();
  let isValid = ADMIN_HASH && passphrase.trim() === ADMIN_HASH;
  if (!isValid) {
    const usersData = await redisFetch(['GET', 'homer:users']);
    if (usersData.result) {
      try {
        const users = JSON.parse(usersData.result);
        for (const user of users) {
          if (user.passwordHash === passphrase.trim()) { isValid = true; break; }
        }
      } catch (e) {}
    }
  }
  if (!isValid) return res.status(403).json({ error: 'Forbidden' });

  const BRAVE_KEY = (process.env.BRAVE_SEARCH_API_KEY || '').trim();
  if (!BRAVE_KEY) return res.status(500).json({ error: 'BRAVE_SEARCH_API_KEY not configured' });

  try {
    const numResults = Math.min(count || 5, 10);
    const url = 'https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(query) + '&count=' + numResults;
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': BRAVE_KEY }
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText);
      return res.status(resp.status).json({ error: 'Brave Search error', detail: errText });
    }

    const data = await resp.json();
    const results = [];

    // Web results
    if (data.web && data.web.results) {
      for (const r of data.web.results.slice(0, numResults)) {
        results.push({
          title: r.title || '',
          url: r.url || '',
          description: r.description || '',
          age: r.age || ''
        });
      }
    }

    // Infobox / knowledge panel
    let infobox = null;
    if (data.infobox) {
      infobox = {
        title: data.infobox.title || '',
        description: data.infobox.description || '',
        url: data.infobox.url || ''
      };
    }

    return res.status(200).json({ ok: true, query, results, infobox });

  } catch (err) {
    return res.status(500).json({ error: 'Search failed', detail: err.message });
  }
}

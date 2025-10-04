export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url param' });

  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const allowed = new Set([
    'cloud.b4it.ro',
    'reminder.b4it.ro',
    'journal.b4it.ro',
    'tasks.b4it.ro',
    'password.b4it.ro',
    'b4it.go.ro',
    'ntfy.sh',
    'www.tnas.online',
    'b4it.ro'
  ]);

  if (!allowed.has(hostname)) {
    return res.status(403).json({ error: 'Forbidden host', hostname });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, {
      method: 'HEAD',
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeout);
    const ok = resp.ok || (resp.status >= 200 && resp.status < 500);
    res
      .status(200)
      .json({ status: ok ? 'ok' : 'down', code: resp.status, hostname });
  } catch (err) {
    res
      .status(200)
      .json({ status: 'down', error: err.message, hostname });
  }
}

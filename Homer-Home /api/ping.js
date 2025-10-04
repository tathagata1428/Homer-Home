export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url param' });

  const allowed = [
    'b4it.ro',
    'b4it.go.ro',
    'ntfy.sh',
    'reminder.b4it.ro',
    'journal.b4it.ro',
    'tasks.b4it.ro',
    'password.b4it.ro'
  ];
  if (!allowed.some(host => url.includes(host))) {
    return res.status(403).json({ error: 'Forbidden host' });
  }

  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store', redirect: 'follow' });
    if (r.ok) return res.status(200).json({ status: 'ok' });
    else return res.status(503).json({ status: 'down' });
  } catch (e) {
    return res.status(503).json({ status: 'down' });
  }
}

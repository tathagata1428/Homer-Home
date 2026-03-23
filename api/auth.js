import crypto from 'crypto';

function hashUserPass(username, password) {
  return crypto.createHash('sha256').update(username.toLowerCase().trim() + ':' + password).digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  var REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(500).json({ error: 'Redis not configured' });

  async function redis(cmd) {
    var r = await fetch(REDIS_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN },
      body: JSON.stringify(cmd)
    });
    return r.json();
  }

  try {
    var body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    var action = body.action;

    if (action === 'verify') {
      var username = body.username;
      var password = body.password;
      if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

      var usersData = await redis(['GET', 'homer:users']);
      var users = [];
      if (usersData.result) {
        try { users = JSON.parse(usersData.result); } catch (e) {}
      }

      // Create default user if none exist
      if (users.length === 0) {
        users = [{
          username: 'bogdan',
          email: 'bogdan.radu@b4it.ro',
          passwordHash: hashUserPass('bogdan', 'QAZwsx098pl.!'),
          permissions: { vault: true, joey: true },
          createdAt: Date.now()
        }];
        await redis(['SET', 'homer:users', JSON.stringify(users)]);
      }

      var user = users.find(function(u) { return u.username.toLowerCase() === username.toLowerCase(); });
      if (!user) return res.status(403).json({ error: 'User not found' });

      var passHash = hashUserPass(username, password);
      if (user.passwordHash !== passHash) return res.status(403).json({ error: 'Invalid password' });

      return res.status(200).json({
        ok: true,
        username: user.username,
        email: user.email,
        permissions: user.permissions
      });
    }

    if (action === 'getPermissions') {
      var username = body.username;
      if (!username) return res.status(400).json({ error: 'Missing username' });

      var usersData = await redis(['GET', 'homer:users']);
      var users = [];
      if (usersData.result) {
        try { users = JSON.parse(usersData.result); } catch (e) {}
      }

      var user = users.find(function(u) { return u.username.toLowerCase() === username.toLowerCase(); });
      if (!user) return res.status(404).json({ error: 'User not found' });

      return res.status(200).json({
        ok: true,
        permissions: user.permissions
      });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}

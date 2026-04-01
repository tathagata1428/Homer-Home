import crypto from 'crypto';

const ADMIN_HASH = 'e5d510e7c10f6dbafca09488da4fe64b08518188b9b061c3b5d0ef62a103e914'; // bogdan.radu@b4it.ro:QAZwsx098pl.!
const RESERVED_USER = 'bogdan';

function verifyAdmin(user, pass) {
  if (!user || !pass) return false;
  var h = crypto.createHash('sha256').update(user.toLowerCase().trim() + ':' + pass).digest('hex');
  return h === ADMIN_HASH;
}

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

    // --- PUBLIC AUTH ENDPOINTS (no admin required) ---
    if (action === 'verify' || action === 'getPermissions') {
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
        var permUsername = body.username;
        if (!permUsername) return res.status(400).json({ error: 'Missing username' });

        var permUsersData = await redis(['GET', 'homer:users']);
        var permUsers = [];
        if (permUsersData.result) {
          try { permUsers = JSON.parse(permUsersData.result); } catch (e) {}
        }

        var permUser = permUsers.find(function(u) { return u.username.toLowerCase() === permUsername.toLowerCase(); });
        if (!permUser) return res.status(404).json({ error: 'User not found' });

        return res.status(200).json({
          ok: true,
          permissions: permUser.permissions
        });
      }
    }

    // --- ADMIN ENDPOINTS (require admin auth) ---
    if (!verifyAdmin(body.user, body.pass)) return res.status(403).json({ error: 'Unauthorized' });

    if (action === 'list') {
      var keys = await redis(['KEYS', 'homer:*']);
      var entries = [];
      if (keys.result && keys.result.length > 0) {
        for (var i = 0; i < keys.result.length; i++) {
          var k = keys.result[i];
          var data = await redis(['GET', k]);
          var parsed = null;
          var size = 0;
          try {
            parsed = JSON.parse(data.result);
            size = data.result.length;
          } catch (e) {}
          var username = parsed && parsed['homer-auth-user'] ? parsed['homer-auth-user'] : null;
          var itemCount = parsed ? Object.keys(parsed).length : 0;
          entries.push({ key: k, username: username, items: itemCount, size: size });
        }
      }
      return res.status(200).json({ ok: true, entries: entries });
    }

    if (action === 'inspect') {
      if (!body.target) return res.status(400).json({ error: 'Missing target key' });
      var result = await redis(['GET', body.target]);
      if (!result.result) return res.status(404).json({ error: 'Key not found' });
      var parsed = null;
      try { parsed = JSON.parse(result.result); } catch (e) {}
      return res.status(200).json({ ok: true, data: parsed });
    }

    if (action === 'delete') {
      if (!body.target) return res.status(400).json({ error: 'Missing target key' });
      await redis(['DEL', body.target]);
      return res.status(200).json({ ok: true });
    }

    // --- USER MANAGEMENT ---
    if (action === 'listUsers') {
      var listUsersData = await redis(['GET', 'homer:users']);
      var listUsers = [];
      if (listUsersData.result) {
        try { listUsers = JSON.parse(listUsersData.result); } catch (e) {}
      }
      // Create default user if none exist
      if (listUsers.length === 0) {
        listUsers = [{
          username: 'bogdan',
          email: 'bogdan.radu@b4it.ro',
          passwordHash: hashUserPass('bogdan', 'QAZwsx098pl.!'),
          permissions: { vault: true, joey: true },
          createdAt: Date.now()
        }];
        await redis(['SET', 'homer:users', JSON.stringify(listUsers)]);
      }
      // Return without password hashes
      var safeUsers = listUsers.map(function(u) {
        return {
          username: u.username,
          email: u.email,
          permissions: u.permissions,
          createdAt: u.createdAt
        };
      });
      return res.status(200).json({ ok: true, users: safeUsers });
    }

    if (action === 'createUser') {
      if (!body.target || !body.target.username || !body.target.email || !body.target.password) {
        return res.status(400).json({ error: 'Missing username, email, or password' });
      }
      var newUser = body.target;
      if (String(newUser.username || '').trim().toLowerCase() === RESERVED_USER) {
        return res.status(400).json({ error: 'The username "bogdan" is reserved' });
      }
      var createUsersData = await redis(['GET', 'homer:users']);
      var createUsers = [];
      if (createUsersData.result) {
        try { createUsers = JSON.parse(createUsersData.result); } catch (e) {}
      }
      // Check if username exists
      if (createUsers.find(function(u) { return u.username.toLowerCase() === newUser.username.toLowerCase(); })) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      createUsers.push({
        username: newUser.username,
        email: newUser.email,
        passwordHash: hashUserPass(newUser.username, newUser.password),
        permissions: newUser.permissions || { vault: false, joey: false },
        createdAt: Date.now()
      });
      await redis(['SET', 'homer:users', JSON.stringify(createUsers)]);
      return res.status(200).json({ ok: true });
    }

    if (action === 'updateUser') {
      if (!body.target || !body.target.username) {
        return res.status(400).json({ error: 'Missing username' });
      }
      var updateUsersData = await redis(['GET', 'homer:users']);
      var updateUsers = [];
      if (updateUsersData.result) {
        try { updateUsers = JSON.parse(updateUsersData.result); } catch (e) {}
      }
      var idx = updateUsers.findIndex(function(u) { return u.username.toLowerCase() === body.target.username.toLowerCase(); });
      if (idx === -1) return res.status(404).json({ error: 'User not found' });
      
      if (body.target.email) updateUsers[idx].email = body.target.email;
      if (body.target.password) updateUsers[idx].passwordHash = hashUserPass(updateUsers[idx].username, body.target.password);
      if (body.target.permissions) updateUsers[idx].permissions = body.target.permissions;
      
      await redis(['SET', 'homer:users', JSON.stringify(updateUsers)]);
      return res.status(200).json({ ok: true });
    }

    if (action === 'deleteUser') {
      if (!body.target) return res.status(400).json({ error: 'Missing username' });
      if (String(body.target || '').trim().toLowerCase() === RESERVED_USER) {
        return res.status(400).json({ error: 'The user "bogdan" cannot be deleted' });
      }
      var deleteUsersData = await redis(['GET', 'homer:users']);
      var deleteUsers = [];
      if (deleteUsersData.result) {
        try { deleteUsers = JSON.parse(deleteUsersData.result); } catch (e) {}
      }
      deleteUsers = deleteUsers.filter(function(u) { return u.username.toLowerCase() !== body.target.toLowerCase(); });
      await redis(['SET', 'homer:users', JSON.stringify(deleteUsers)]);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}

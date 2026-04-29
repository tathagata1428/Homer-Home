import crypto from 'crypto';
import { verifySupabaseJwt, isSupabaseClientConfigured } from '../../lib/supabase-server.js';

const ADMIN_HASH = 'e5d510e7c10f6dbafca09488da4fe64b08518188b9b061c3b5d0ef62a103e914'; // bogdan.radu@b4it.ro:QAZwsx098pl.!
const RESERVED_USER = 'bogdan';
const RESERVED_USER_EMAIL = 'bogdan.radu@b4it.ro';
const RESERVED_USER_PASSWORD_HEX = ['5f64', '6563', '3064', '3344', '2e64', '6f63'];

function verifyAdmin(user, pass) {
  if (!user || !pass) return false;
  var h = crypto.createHash('sha256').update(user.toLowerCase().trim() + ':' + pass).digest('hex');
  return h === ADMIN_HASH;
}

function hashUserPass(username, password) {
  return crypto.createHash('sha256').update(username.toLowerCase().trim() + ':' + password).digest('hex');
}

function getReservedUserPassword() {
  return Buffer.from(RESERVED_USER_PASSWORD_HEX.join(''), 'hex').toString('utf8');
}

function buildReservedUser(existing) {
  return {
    username: RESERVED_USER,
    email: RESERVED_USER_EMAIL,
    passwordHash: hashUserPass(RESERVED_USER, getReservedUserPassword()),
    permissions: existing && existing.permissions ? existing.permissions : { vault: true, joey: true },
    createdAt: existing && existing.createdAt ? existing.createdAt : Date.now()
  };
}

function ensureReservedUser(users) {
  var list = Array.isArray(users) ? users.slice() : [];
  var idx = list.findIndex(function(u) {
    return String(u && u.username || '').trim().toLowerCase() === RESERVED_USER;
  });
  var existing = idx >= 0 ? list[idx] : null;
  var reserved = buildReservedUser(existing);
  var changed = !existing
    || existing.email !== reserved.email
    || existing.passwordHash !== reserved.passwordHash
    || JSON.stringify(existing.permissions || {}) !== JSON.stringify(reserved.permissions || {});

  if (idx >= 0) list[idx] = Object.assign({}, existing, reserved);
  else {
    list.unshift(reserved);
    changed = true;
  }

  return { users: list, changed: changed };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (env && typeof env === "object") Object.assign(process.env, env);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
  }

  var REDIS_URL = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  var REDIS_TOKEN = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!REDIS_URL || !REDIS_TOKEN) {
    return Response.json({ error: 'Redis not configured' }, { status: 500, headers: corsHeaders });
  }

  // Accept Supabase JWT as an alternative to admin credentials
  var authHeader = String(request.headers.get('authorization') || '');
  var jwtToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  var supabaseUser = null;
  if (jwtToken && isSupabaseClientConfigured()) {
    supabaseUser = await verifySupabaseJwt(jwtToken);
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
    var body;
    try {
      body = await request.json();
    } catch (e) {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders });
    }
    var action = body.action;

    // --- PUBLIC AUTH ENDPOINTS (no admin required) ---
    if (action === 'verify' || action === 'getPermissions') {
      if (action === 'verify') {
        var username = body.username;
        var password = body.password;
        if (!username || !password) {
          return Response.json({ error: 'Missing credentials' }, { status: 400, headers: corsHeaders });
        }

        var usersData = await redis(['GET', 'homer:users']);
        var users = [];
        if (usersData.result) {
          try { users = JSON.parse(usersData.result); } catch (e) {}
        }

        var ensuredUsers = ensureReservedUser(users);
        users = ensuredUsers.users;
        if (ensuredUsers.changed) {
          await redis(['SET', 'homer:users', JSON.stringify(users)]);
        }

        var user = users.find(function(u) { return u.username.toLowerCase() === username.toLowerCase(); });
        if (!user) return Response.json({ error: 'User not found' }, { status: 403, headers: corsHeaders });

        var passHash = hashUserPass(username, password);
        if (user.passwordHash !== passHash) {
          return Response.json({ error: 'Invalid password' }, { status: 403, headers: corsHeaders });
        }

        return Response.json({
          ok: true,
          username: user.username,
          email: user.email,
          permissions: user.permissions
        }, { status: 200, headers: corsHeaders });
      }

      if (action === 'getPermissions') {
        var permUsername = body.username;
        if (!permUsername) {
          return Response.json({ error: 'Missing username' }, { status: 400, headers: corsHeaders });
        }

        var permUsersData = await redis(['GET', 'homer:users']);
        var permUsers = [];
        if (permUsersData.result) {
          try { permUsers = JSON.parse(permUsersData.result); } catch (e) {}
        }
        var ensuredPermUsers = ensureReservedUser(permUsers);
        permUsers = ensuredPermUsers.users;
        if (ensuredPermUsers.changed) {
          await redis(['SET', 'homer:users', JSON.stringify(permUsers)]);
        }

        var permUser = permUsers.find(function(u) { return u.username.toLowerCase() === permUsername.toLowerCase(); });
        if (!permUser) return Response.json({ error: 'User not found' }, { status: 404, headers: corsHeaders });

        return Response.json({
          ok: true,
          permissions: permUser.permissions
        }, { status: 200, headers: corsHeaders });
      }
    }

    // --- ADMIN ENDPOINTS (require admin auth or Supabase JWT) ---
    var adminOk = supabaseUser != null || verifyAdmin(body.user, body.pass);
    if (!adminOk) return Response.json({ error: 'Unauthorized' }, { status: 403, headers: corsHeaders });

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
          var uname = parsed && parsed['homer-auth-user'] ? parsed['homer-auth-user'] : null;
          var itemCount = parsed ? Object.keys(parsed).length : 0;
          entries.push({ key: k, username: uname, items: itemCount, size: size });
        }
      }
      return Response.json({ ok: true, entries: entries }, { status: 200, headers: corsHeaders });
    }

    if (action === 'inspect') {
      if (!body.target) return Response.json({ error: 'Missing target key' }, { status: 400, headers: corsHeaders });
      var result = await redis(['GET', body.target]);
      if (!result.result) return Response.json({ error: 'Key not found' }, { status: 404, headers: corsHeaders });
      var parsedInspect = null;
      try { parsedInspect = JSON.parse(result.result); } catch (e) {}
      return Response.json({ ok: true, data: parsedInspect }, { status: 200, headers: corsHeaders });
    }

    if (action === 'delete') {
      if (!body.target) return Response.json({ error: 'Missing target key' }, { status: 400, headers: corsHeaders });
      await redis(['DEL', body.target]);
      return Response.json({ ok: true }, { status: 200, headers: corsHeaders });
    }

    // --- USER MANAGEMENT ---
    if (action === 'listUsers') {
      var listUsersData = await redis(['GET', 'homer:users']);
      var listUsers = [];
      if (listUsersData.result) {
        try { listUsers = JSON.parse(listUsersData.result); } catch (e) {}
      }
      var ensuredListUsers = ensureReservedUser(listUsers);
      listUsers = ensuredListUsers.users;
      if (ensuredListUsers.changed) {
        await redis(['SET', 'homer:users', JSON.stringify(listUsers)]);
      }
      var safeUsers = listUsers.map(function(u) {
        return {
          username: u.username,
          email: u.email,
          permissions: u.permissions,
          createdAt: u.createdAt
        };
      });
      return Response.json({ ok: true, users: safeUsers }, { status: 200, headers: corsHeaders });
    }

    if (action === 'createUser') {
      if (!body.target || !body.target.username || !body.target.email || !body.target.password) {
        return Response.json({ error: 'Missing username, email, or password' }, { status: 400, headers: corsHeaders });
      }
      var newUser = body.target;
      if (String(newUser.username || '').trim().toLowerCase() === RESERVED_USER) {
        return Response.json({ error: 'The username "bogdan" is reserved' }, { status: 400, headers: corsHeaders });
      }
      var createUsersData = await redis(['GET', 'homer:users']);
      var createUsers = [];
      if (createUsersData.result) {
        try { createUsers = JSON.parse(createUsersData.result); } catch (e) {}
      }
      if (createUsers.find(function(u) { return u.username.toLowerCase() === newUser.username.toLowerCase(); })) {
        return Response.json({ error: 'Username already exists' }, { status: 400, headers: corsHeaders });
      }
      createUsers.push({
        username: newUser.username,
        email: newUser.email,
        passwordHash: hashUserPass(newUser.username, newUser.password),
        permissions: newUser.permissions || { vault: false, joey: false },
        createdAt: Date.now()
      });
      await redis(['SET', 'homer:users', JSON.stringify(createUsers)]);
      return Response.json({ ok: true }, { status: 200, headers: corsHeaders });
    }

    if (action === 'updateUser') {
      if (!body.target || !body.target.username) {
        return Response.json({ error: 'Missing username' }, { status: 400, headers: corsHeaders });
      }
      var updateUsersData = await redis(['GET', 'homer:users']);
      var updateUsers = [];
      if (updateUsersData.result) {
        try { updateUsers = JSON.parse(updateUsersData.result); } catch (e) {}
      }
      var ensuredUpdateUsers = ensureReservedUser(updateUsers);
      updateUsers = ensuredUpdateUsers.users;
      var updateIdx = updateUsers.findIndex(function(u) { return u.username.toLowerCase() === body.target.username.toLowerCase(); });
      if (updateIdx === -1) return Response.json({ error: 'User not found' }, { status: 404, headers: corsHeaders });

      if (body.target.email) updateUsers[updateIdx].email = body.target.email;
      if (body.target.password) updateUsers[updateIdx].passwordHash = hashUserPass(updateUsers[updateIdx].username, body.target.password);
      if (body.target.permissions) updateUsers[updateIdx].permissions = body.target.permissions;
      if (String(updateUsers[updateIdx].username || '').trim().toLowerCase() === RESERVED_USER) {
        updateUsers[updateIdx] = buildReservedUser(updateUsers[updateIdx]);
      }

      await redis(['SET', 'homer:users', JSON.stringify(updateUsers)]);
      return Response.json({ ok: true }, { status: 200, headers: corsHeaders });
    }

    if (action === 'deleteUser') {
      if (!body.target) return Response.json({ error: 'Missing username' }, { status: 400, headers: corsHeaders });
      if (String(body.target || '').trim().toLowerCase() === RESERVED_USER) {
        return Response.json({ error: 'The user "bogdan" cannot be deleted' }, { status: 400, headers: corsHeaders });
      }
      var deleteUsersData = await redis(['GET', 'homer:users']);
      var deleteUsers = [];
      if (deleteUsersData.result) {
        try { deleteUsers = JSON.parse(deleteUsersData.result); } catch (e) {}
      }
      deleteUsers = deleteUsers.filter(function(u) { return u.username.toLowerCase() !== body.target.toLowerCase(); });
      await redis(['SET', 'homer:users', JSON.stringify(deleteUsers)]);
      return Response.json({ ok: true }, { status: 200, headers: corsHeaders });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400, headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message || 'Unknown error' }, { status: 500, headers: corsHeaders });
  }
}

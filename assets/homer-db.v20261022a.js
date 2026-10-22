/**
 * homer-db.js — browser data client for Homer's own Postgres backend.
 *
 * Replaces supabase-js. window.__db keeps the same call shape the app
 * already uses:
 *   __db.from('field_state').select('value').eq('field_id', id).maybeSingle()
 *   __db.from('field_state').upsert(row, { onConflict: 'user_id,field_id' })
 *   __db.auth.getSession() / setSession() / signOut() / onAuthStateChange()
 *   __db.channel(name).on('postgres_changes', { table }, cb).subscribe()
 *
 * Queries go to POST /api/db. "Realtime" is a poll of /api/db (op "changes")
 * every POLL_MS while the tab is visible; rows arrive as
 * { eventType, table, new, old } just like Supabase payloads.
 *
 * Window events: db:session, db:authchange, db:field, db:message,
 * db:memory, db:task.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'homer_db_session';
  var POLL_MS = 10000;
  var REFRESH_BEFORE_S = 24 * 3600;

  var session = null;
  var authListeners = [];

  function readStored() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_e) { return null; }
  }
  function writeStored(s) {
    try {
      if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (_e) {}
  }
  function isExpired(s) {
    return !s || !s.access_token || (s.expires_at && s.expires_at * 1000 < Date.now());
  }
  function emitAuth(event) {
    window.__dbSession = session;
    authListeners.forEach(function (cb) { try { cb(event, session); } catch (_e) {} });
    window.dispatchEvent(new CustomEvent('db:session', { detail: session }));
    window.dispatchEvent(new CustomEvent('db:authchange', { detail: { event: event, session: session } }));
  }
  function setLocalSession(s, event) {
    session = s && s.access_token ? s : null;
    writeStored(session);
    emitAuth(event || (session ? 'SIGNED_IN' : 'SIGNED_OUT'));
    if (session) startPolling();
  }

  function postJson(url, body, token) {
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body), cache: 'no-store' })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok && !d.error) d.error = { message: 'HTTP ' + r.status };
          if (typeof d.error === 'string') d.error = { message: d.error };
          return d;
        });
      });
  }

  function refreshIfNeeded() {
    if (!session || !session.refresh_token || !session.expires_at) return Promise.resolve(session);
    if (session.expires_at - Date.now() / 1000 > REFRESH_BEFORE_S) return Promise.resolve(session);
    return postJson('/api/auth', { action: 'refresh', refreshToken: session.refresh_token }).then(function (d) {
      if (d && d.ok && d.session) setLocalSession(d.session, 'TOKEN_REFRESHED');
      else if (isExpired(session)) setLocalSession(null, 'SIGNED_OUT');
      return session;
    }).catch(function () { return session; });
  }

  // ── Query builder ──────────────────────────────────────────

  function Builder(table) {
    this.spec = {
      table: table, op: 'select', columns: '*', returning: null, filters: [], orders: [],
      limit: null, offset: null, single: null, values: null, onConflict: null, ignoreDuplicates: false
    };
  }
  Builder.prototype.select = function (cols) {
    if (this.spec.op === 'select') this.spec.columns = cols == null ? '*' : cols;
    else this.spec.returning = cols == null ? '*' : cols;
    return this;
  };
  Builder.prototype.insert = function (v) { this.spec.op = 'insert'; this.spec.values = v; return this; };
  Builder.prototype.upsert = function (v, o) {
    this.spec.op = 'upsert'; this.spec.values = v;
    this.spec.onConflict = (o && o.onConflict) || 'id';
    this.spec.ignoreDuplicates = !!(o && o.ignoreDuplicates);
    return this;
  };
  Builder.prototype.update = function (v) { this.spec.op = 'update'; this.spec.values = v; return this; };
  Builder.prototype['delete'] = function () { this.spec.op = 'delete'; return this; };
  ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is'].forEach(function (op) {
    Builder.prototype[op] = function (col, value) { this.spec.filters.push({ col: col, op: op, value: value }); return this; };
  });
  Builder.prototype.not = function (col, op, value) { this.spec.filters.push({ col: col, op: 'not.' + op, value: value }); return this; };
  Builder.prototype.match = function (obj) { var self = this; Object.keys(obj || {}).forEach(function (k) { self.eq(k, obj[k]); }); return this; };
  Builder.prototype.order = function (col, o) { this.spec.orders.push({ col: col, asc: !(o && o.ascending === false) }); return this; };
  Builder.prototype.limit = function (n) { this.spec.limit = n; return this; };
  Builder.prototype.range = function (from, to) { this.spec.offset = from; this.spec.limit = to - from + 1; return this; };
  Builder.prototype.single = function () { this.spec.single = 'single'; return this; };
  Builder.prototype.maybeSingle = function () { this.spec.single = 'maybe'; return this; };
  Builder.prototype.then = function (resolve, reject) {
    var spec = this.spec;
    return refreshIfNeeded().then(function (s) {
      if (!s || isExpired(s)) return { data: null, error: { message: 'Not signed in' } };
      return postJson('/api/db', spec, s.access_token).then(function (d) {
        return { data: d.data === undefined ? null : d.data, error: d.error || null, count: d.count == null ? null : d.count };
      });
    }).catch(function (err) {
      return { data: null, error: { message: (err && err.message) || String(err) } };
    }).then(resolve, reject);
  };

  // ── Change polling (stands in for Realtime) ────────────────

  var subscriptions = []; // { table, cb }
  var cursors = {};
  var seen = {};
  var seenOrder = [];
  var pollTimer = null;
  var polling = false;

  function rowKey(table, row) {
    return table + ':' + (row.id || row.field_id || '') + ':' + (row.updated_at || row.created_at || '');
  }
  function markSeen(key) {
    if (seen[key]) return false;
    seen[key] = true;
    seenOrder.push(key);
    if (seenOrder.length > 4000) delete seen[seenOrder.shift()];
    return true;
  }

  function pollOnce() {
    if (polling || !session || isExpired(session) || !subscriptions.length) return Promise.resolve();
    if (document.visibilityState === 'hidden') return Promise.resolve();
    polling = true;
    var since = {};
    subscriptions.forEach(function (s) { since[s.table] = cursors[s.table] || null; });
    return refreshIfNeeded().then(function () {
      return postJson('/api/db', { op: 'changes', since: since }, session && session.access_token);
    }).then(function (d) {
      if (!d || d.error || !d.now) return;
      Object.keys(since).forEach(function (table) {
        var rows = (d.changes && d.changes[table]) || [];
        // First poll only establishes the cursor.
        if (since[table]) {
          rows.forEach(function (row) {
            if (!markSeen(rowKey(table, row))) return;
            var payload = { eventType: table === 'messages' ? 'INSERT' : 'UPDATE', schema: 'public', table: table, new: row, old: {} };
            subscriptions.forEach(function (s) { if (s.table === table) { try { s.cb(payload); } catch (_e) {} } });
          });
        }
        var last = rows.length ? rows[rows.length - 1] : null;
        var lastTs = last && (last.updated_at || last.created_at);
        // A full page means more rows remain; continue from the last row instead of jumping to now.
        cursors[table] = rows.length >= 500 && lastTs ? lastTs : d.now;
      });
    }).catch(function () {}).then(function () { polling = false; });
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(pollOnce, POLL_MS);
    setTimeout(pollOnce, 0);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') pollOnce();
  });

  function channel() {
    var pending = [];
    var ch = {
      on: function (_type, filter, cb) {
        if (filter && filter.table) pending.push({ table: filter.table, cb: cb });
        return ch;
      },
      subscribe: function () {
        pending.forEach(function (s) { subscriptions.push(s); });
        pending = [];
        if (session) startPolling();
        return ch;
      }
    };
    return ch;
  }

  // ── Public client ──────────────────────────────────────────

  var client = {
    from: function (table) { return new Builder(table); },
    channel: channel,
    auth: {
      getSession: function () {
        return refreshIfNeeded().then(function () { return { data: { session: session }, error: null }; });
      },
      setSession: function (tokens) {
        var access = tokens && tokens.access_token;
        if (!access) return Promise.resolve({ data: { session: null }, error: { message: 'Missing access_token' } });
        return fetch('/api/auth?action=user', { headers: { Authorization: 'Bearer ' + access }, cache: 'no-store' })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (!d || !d.ok) return { data: { session: null }, error: { message: (d && d.error) || 'Invalid token' } };
            var s = Object.assign({}, session || {}, tokens, { user: d.user });
            if (!s.expires_at && tokens.expires_in) s.expires_at = Math.floor(Date.now() / 1000) + tokens.expires_in;
            setLocalSession(s, 'SIGNED_IN');
            return { data: { session: session }, error: null };
          })
          .catch(function (err) { return { data: { session: null }, error: { message: err.message } }; });
      },
      signOut: function () {
        setLocalSession(null, 'SIGNED_OUT');
        return Promise.resolve({ error: null });
      },
      onAuthStateChange: function (cb) {
        authListeners.push(cb);
        return { data: { subscription: { unsubscribe: function () { authListeners = authListeners.filter(function (x) { return x !== cb; }); } } } };
      }
    }
  };

  window.__db = client;

  /** Homer username + password → session (validated against HOMER_ADMIN_HASH). */
  window.dbSignIn = function (username, password) {
    return postJson('/api/auth', { action: 'signIn', username: username, password: password }).then(function (d) {
      if (!d || !d.ok || !d.session) throw new Error((d && d.error && d.error.message) || 'Sign-in failed');
      setLocalSession(d.session, 'SIGNED_IN');
      return { session: d.session, user: d.user };
    });
  };

  window.dbAuthHeader = function () {
    var s = session || readStored();
    if (!s || isExpired(s)) return null;
    return 'Bearer ' + s.access_token;
  };

  // Restore a stored session.
  var stored = readStored();
  if (stored && !isExpired(stored)) {
    session = stored;
    window.__dbSession = session;
    refreshIfNeeded().then(function () { if (session) emitAuth('INITIAL_SESSION'); });
  } else if (stored) {
    writeStored(null);
  }

  // App-wide realtime feeds (the same four Supabase channels as before).
  client.channel('homer-messages').on('postgres_changes', { table: 'messages' }, function (p) {
    window.dispatchEvent(new CustomEvent('db:message', { detail: p }));
  }).subscribe();
  client.channel('homer-memories').on('postgres_changes', { table: 'memories' }, function (p) {
    window.dispatchEvent(new CustomEvent('db:memory', { detail: p }));
  }).subscribe();
  client.channel('homer-tasks').on('postgres_changes', { table: 'tasks' }, function (p) {
    window.dispatchEvent(new CustomEvent('db:task', { detail: p }));
  }).subscribe();
  client.channel('homer-fields').on('postgres_changes', { table: 'field_state' }, function (p) {
    window.dispatchEvent(new CustomEvent('db:field', { detail: p }));
  }).subscribe();
})();

/* Homer — Second Brain Captures
 *
 * The same Captures list the Second Brain desktop, web and phone apps share:
 * throw in an idea, link, note or picture, see what the other devices
 * captured, and send yours to them.
 *
 * Like the rest of Homer (HOMER_SYNC_ON_DEMAND), nothing moves until a Sync
 * is asked for: the panel's Sync button, or Sync Now / Push / Pull in the Sync
 * & Backup panel (app-shell runSync calls _homerCapturesPush/_homerCapturesPull).
 * New captures, edits and deletions wait here (IndexedDB, so pictures fit),
 * marked as not sent, and count as waiting changes.
 *
 * The hub is reached through /api/sb-captures (functions/api/sb-captures.js)
 * with the Homer sign-in; the server uses Homer's own hub device.
 *
 * A capture that a Second Brain desktop sees with status "pending" is sorted
 * there by its AI, exactly like one made on the phone. */
(function () {
  'use strict';

  var API = '/api/sb-captures';
  var DB_NAME = 'homer-sb-captures';
  var DB_VERSION = 1;
  // Same ceiling as Second Brain's own clients: a picture travels as base64
  // inside its row and the hub refuses rows over 32 MB.
  var MAX_PHOTO_BYTES = 22 * 1024 * 1024;

  // ── Storage ───────────────────────────────────────────────────────────
  var dbPromise = null;
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('captures')) db.createObjectStore('captures', { keyPath: 'sync_id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { dbPromise = null; reject(req.error); };
    });
    return dbPromise;
  }
  function tx(store, mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(store, mode);
        var result;
        t.oncomplete = function () { resolve(result); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
        result = fn(t.objectStore(store));
        if (result && 'onsuccess' in result) {
          var req = result;
          req.onsuccess = function () { result = req.result; };
        }
      });
    });
  }
  function allRows() { return tx('captures', 'readonly', function (s) { return s.getAll(); }); }
  function getRow(id) { return tx('captures', 'readonly', function (s) { return s.get(id); }); }
  function putRow(row) { return tx('captures', 'readwrite', function (s) { s.put(row); }); }
  function deleteRow(id) { return tx('captures', 'readwrite', function (s) { s.delete(id); }); }
  function getMeta(key) { return tx('meta', 'readonly', function (s) { return s.get(key); }); }
  function setMeta(key, value) { return tx('meta', 'readwrite', function (s) { s.put(value, key); }); }
  function clearAll() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(['captures', 'meta'], 'readwrite');
        t.objectStore('captures').clear();
        t.objectStore('meta').clear();
        t.oncomplete = function () { resolve(); };
        t.onerror = function () { reject(t.error); };
      });
    });
  }


  // ── Helpers ───────────────────────────────────────────────────────────
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function timeAgo(iso) {
    var t = new Date(iso).getTime();
    if (!t) return '';
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 86400 * 7) return Math.floor(s / 86400) + 'd ago';
    return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  // Only the picture formats a browser draws; anything else (HEIC from an
  // older phone build) is offered as a download instead.
  var DRAWABLE = /^image\/(png|jpe?g|gif|webp|bmp|avif|svg\+xml)$/i;
  function photoSrc(row) {
    if (!row || !row.image_data) return null;
    var type = String(row.image_type || 'image/jpeg').toLowerCase();
    if (!DRAWABLE.test(type) || type === 'image/svg+xml') return null;
    return 'data:' + type + ';base64,' + row.image_data;
  }
  function readPhoto(file) {
    return new Promise(function (resolve) {
      if (!file) return resolve(null);
      if (!String(file.type || '').startsWith('image/')) { say('That is not a picture.', true); return resolve(null); }
      if (file.size > MAX_PHOTO_BYTES) {
        say('That picture is ' + Math.round(file.size / 1048576) + ' MB; the limit is 22 MB so it can reach your other devices.', true);
        return resolve(null);
      }
      var r = new FileReader();
      r.onload = function () {
        var s = String(r.result || '');
        resolve({ image_name: file.name || 'picture', image_type: file.type || 'image/jpeg', image_data: s.slice(s.indexOf(',') + 1) });
      };
      r.onerror = function () { say('That picture could not be read.', true); resolve(null); };
      r.readAsDataURL(file);
    });
  }
  function downloadPhoto(row) {
    var bin = atob(row.image_data), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([bytes], { type: row.image_type || 'application/octet-stream' }));
    var ext = String(row.image_type || 'image/jpeg').split('/')[1] || 'jpg';
    var a = document.createElement('a');
    a.href = url;
    a.download = row.image_name && !/^photo\./i.test(row.image_name) ? row.image_name : 'capture-' + String(row.sync_id).slice(0, 8) + '.' + ext;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  // ── Hub ───────────────────────────────────────────────────────────────
  // The Homer session, refreshed first when it is about to run out.
  function authHeader() {
    var fresh = window.__db && window.__db.auth ? window.__db.auth.getSession().catch(function () {}) : Promise.resolve();
    return fresh.then(function () { return typeof window.dbAuthHeader === 'function' ? window.dbAuthHeader() : null; });
  }
  function call(body) {
    return authHeader().then(function (auth) {
      if (!auth) throw new Error('Sign in to Homer (Account) to sync captures.');
      return fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify(body),
        cache: 'no-store'
      });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (r.status === 401) throw new Error('Your Homer sign-in has ended. Sign in again (Account) to sync captures.');
        if (!r.ok) throw new Error(data.error || ('Second Brain answered ' + r.status));
        return data;
      });
    });
  }

  // Pulls every capture changed on the hub since the last pull. A capture
  // edited here and not sent yet is kept when it is newer than the hub's.
  async function pull() {
    var since = (await getMeta('sinceSeq')) || 0;
    for (var guard = 0; guard < 200; guard++) {
      var data = await call({ action: 'pull', sinceSeq: since });
      var rows = Array.isArray(data.rows) ? data.rows : [];
      for (var i = 0; i < rows.length; i++) {
        var hubRow = rows[i];
        var local = await getRow(hubRow.sync_id);
        if (local && local._dirty && String(local.updated_at) > String(hubRow.updated_at)) continue;
        if (hubRow.deleted_at) await deleteRow(hubRow.sync_id);
        else await putRow(Object.assign({}, hubRow, { _dirty: false }));
      }
      var next = data.nextSeq == null ? since : data.nextSeq;
      if (!rows.length || String(next) === String(since)) break;
      since = next;
      await setMeta('sinceSeq', since);
    }
  }

  var COLUMNS = ['content', 'source', 'status', 'category', 'tags', 'error', 'processed_at', 'image_name', 'image_type', 'image_data'];
  function wireRow(row) {
    var out = { sync_id: row.sync_id, created_at: row.created_at, updated_at: row.updated_at, deleted_at: row.deleted_at || null };
    COLUMNS.forEach(function (c) { out[c] = row[c] === undefined ? null : row[c]; });
    // NOT NULL on the hub; a null bypasses its default.
    if (!Array.isArray(out.tags)) out.tags = [];
    if (out.content == null) out.content = '';
    if (!out.source) out.source = 'homer';
    if (!out.status) out.status = 'pending';
    return out;
  }

  // One row per request: a picture can be tens of MB.
  async function push() {
    var rows = (await allRows()).filter(function (r) { return r._dirty; });
    var sent = 0, failed = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var res = await call({ action: 'push', rows: [wireRow(row)] });
      var ok = (res.accepted || []).some(function (a) { return a.sync_id === row.sync_id; });
      var rej = (res.rejected || []).filter(function (a) { return a.sync_id === row.sync_id; })[0];
      if (ok || (rej && rej.reason === 'stale-conflict')) {
        // Accepted, or the hub holds a newer edit made elsewhere: either way
        // the next pull brings the hub's version.
        if (row.deleted_at) await deleteRow(row.sync_id);
        else await putRow(Object.assign({}, row, { _dirty: false, _sent: true }));
        if (ok) sent++;
      } else {
        failed.push(rej && rej.reason ? rej.reason : (res.error || 'not accepted'));
      }
    }
    return { sent: sent, failed: failed };
  }

  // ── Panel ─────────────────────────────────────────────────────────────
  var el = null, pendingPhoto = null, editing = null, busy = false;

  function injectCss() {
    if (document.getElementById('sbcap-css')) return;
    var css = document.createElement('style');
    css.id = 'sbcap-css';
    css.textContent = [
      '#sbcap-overlay{position:fixed;inset:0;z-index:10500;background:rgba(2,6,23,.85);backdrop-filter:blur(7px);display:none;align-items:flex-start;justify-content:center;padding:56px 16px 24px;overflow-y:auto;}',
      '#sbcap-box{width:min(720px,100%);background:linear-gradient(160deg,#0f1729,#020617);border:1px solid rgba(255,255,255,.18);border-radius:20px;padding:22px;box-shadow:0 24px 80px rgba(2,6,23,.65);box-sizing:border-box;}',
      '.sbcap-head{display:flex;align-items:flex-start;gap:10px;margin-bottom:14px;}',
      '.sbcap-head h3{margin:0;font-size:1.1rem;}',
      '.sbcap-sub{font-size:.78rem;color:var(--muted);margin-top:3px;}',
      '.sbcap-head .sbcap-grow{flex:1;min-width:0;}',
      '.sbcap-x{background:none;border:none;color:var(--muted);font-size:1.4rem;cursor:pointer;line-height:1;padding:0 4px;}',
      '.sbcap-field{width:100%;box-sizing:border-box;padding:11px 14px;border-radius:11px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:var(--text);font-size:.95rem;font-family:inherit;}',
      '.sbcap-add{display:flex;gap:8px;align-items:flex-end;border-radius:14px;}',
      '.sbcap-add.dragging{outline:2px dashed var(--accent);outline-offset:4px;}',
      '.sbcap-add textarea{flex:1;min-height:44px;max-height:180px;resize:vertical;}',
      '.sbcap-btn{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:var(--text);border-radius:11px;padding:9px 13px;font:inherit;font-size:.88rem;cursor:pointer;white-space:nowrap;}',
      '.sbcap-btn:hover{background:rgba(255,255,255,.12);}',
      '.sbcap-btn:disabled{opacity:.5;cursor:default;}',
      '.sbcap-btn.primary{background:var(--accent);border-color:var(--accent);color:#04120a;font-weight:700;}',
      '.sbcap-btn.sm{padding:5px 9px;font-size:.78rem;border-radius:9px;}',
      '.sbcap-btn.danger{color:#fca5a5;}',
      '.sbcap-count{display:inline-block;min-width:18px;padding:0 5px;margin-left:6px;border-radius:9px;background:#f59e0b;color:#1a1300;font-size:.72rem;font-weight:800;line-height:18px;text-align:center;}',
      '.sbcap-status{font-size:.8rem;color:var(--muted);min-height:18px;margin:10px 2px 4px;}',
      '.sbcap-status.err{color:#fca5a5;}',
      '.sbcap-pending{display:flex;align-items:center;gap:10px;margin-top:10px;font-size:.82rem;color:var(--muted);}',
      '.sbcap-pending img{width:52px;height:52px;object-fit:cover;border-radius:9px;}',
      '.sbcap-list{display:flex;flex-direction:column;gap:10px;margin-top:8px;}',
      '.sbcap-item{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);border-radius:14px;padding:12px 14px;}',
      '.sbcap-item.unsent{border-color:rgba(245,158,11,.45);}',
      '.sbcap-text{white-space:pre-wrap;word-break:break-word;font-size:.93rem;line-height:1.45;}',
      '.sbcap-text a{color:var(--accent-2);}',
      '.sbcap-photo{margin-top:8px;display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap;}',
      '.sbcap-photo img{max-width:min(260px,100%);max-height:220px;border-radius:10px;cursor:zoom-in;display:block;}',
      '.sbcap-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:8px;font-size:.75rem;color:var(--muted);}',
      '.sbcap-badge{padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.08);}',
      '.sbcap-badge.done{background:rgba(34,197,94,.18);color:#86efac;}',
      '.sbcap-badge.error{background:rgba(239,68,68,.18);color:#fca5a5;}',
      '.sbcap-badge.unsent{background:rgba(245,158,11,.2);color:#fcd34d;}',
      '.sbcap-meta .sbcap-grow{flex:1;}',
      '.sbcap-empty{text-align:center;color:var(--muted);padding:34px 10px;font-size:.9rem;}',
      '.sbcap-empty div{font-size:2rem;margin-bottom:6px;}',
      '.sbcap-edit{display:flex;flex-direction:column;gap:8px;}',
      '.sbcap-row{display:flex;gap:6px;flex-wrap:wrap;}',
      '#sbcap-lightbox{position:fixed;inset:0;z-index:10600;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;padding:16px;box-sizing:border-box;}',
      '#sbcap-lightbox img{max-width:100%;max-height:calc(100% - 60px);object-fit:contain;}',
      '@media (max-width:600px){#sbcap-overlay{padding:12px 8px 80px;}#sbcap-box{padding:16px;border-radius:16px;}.sbcap-add{flex-wrap:wrap;}.sbcap-add textarea{flex-basis:100%;order:-1;}}',
    ].join('\n');
    document.head.appendChild(css);
  }

  function say(msg, isErr) {
    var s = el && el.querySelector('.sbcap-status');
    if (!s) return;
    s.textContent = msg || '';
    s.classList.toggle('err', !!isErr);
  }

  function linkify(text) {
    return esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  var SOURCE_ICON = { ios: '📱', android: '📱', mobile: '📱', web: '🌐', homer: '🏠', desktop: '🖥️' };
  function sourceLabel(src) {
    var s = String(src || 'desktop');
    return (SOURCE_ICON[s] || '🖥️') + ' ' + (s === 'homer' ? 'Homer' : s === 'ios' ? 'iPhone' : s.charAt(0).toUpperCase() + s.slice(1));
  }

  function itemHtml(c) {
    if (editing && editing.id === c.sync_id) {
      var p = editing.photo === undefined ? c : (editing.photo || {});
      var src = photoSrc(p);
      return '<div class="sbcap-item" data-id="' + c.sync_id + '"><div class="sbcap-edit">' +
        '<textarea class="sbcap-field" data-edit-text rows="3">' + esc(c.content) + '</textarea>' +
        (p.image_data ? '<div class="sbcap-photo">' + (src ? '<img src="' + src + '" alt="">' : '<span class="sbcap-sub">Picture in a format this browser cannot show.</span>') + '</div>' : '') +
        '<div class="sbcap-row">' +
          '<button class="sbcap-btn sm" data-edit-photo>📷 ' + (p.image_data ? 'Replace picture' : 'Add picture') + '</button>' +
          (p.image_data ? '<button class="sbcap-btn sm" data-edit-unphoto>Remove picture</button>' : '') +
          '<span style="flex:1"></span>' +
          '<button class="sbcap-btn sm" data-edit-cancel>Cancel</button>' +
          '<button class="sbcap-btn sm primary" data-edit-save>Save</button>' +
        '</div></div></div>';
    }
    var img = photoSrc(c);
    return '<div class="sbcap-item' + (c._dirty ? ' unsent' : '') + '" data-id="' + c.sync_id + '">' +
      (c.content ? '<div class="sbcap-text">' + linkify(c.content) + '</div>' : '') +
      (c.image_data ? '<div class="sbcap-photo">' +
        (img ? '<img src="' + img + '" alt="" data-open-photo title="See it full size">' : '<span class="sbcap-sub">Picture in a format this browser cannot show.</span>') +
        '<button class="sbcap-btn sm" data-download>⬇ Download</button></div>' : '') +
      '<div class="sbcap-meta">' +
        (c._dirty ? '<span class="sbcap-badge unsent">not sent</span>' : '') +
        '<span class="sbcap-badge ' + esc(c.status === 'done' || c.status === 'error' ? c.status : '') + '">' + esc(c.status || 'pending') + '</span>' +
        (c.category ? '<span class="sbcap-badge">' + esc(c.category) + '</span>' : '') +
        (Array.isArray(c.tags) ? c.tags.slice(0, 4).map(function (t) { return '<span class="sbcap-badge">#' + esc(t) + '</span>'; }).join('') : '') +
        '<span>' + sourceLabel(c.source) + ' · ' + esc(timeAgo(c.created_at)) + '</span>' +
        '<span class="sbcap-grow"></span>' +
        '<button class="sbcap-btn sm" data-edit>Edit</button>' +
        '<button class="sbcap-btn sm danger" data-delete title="Delete">✕</button>' +
      '</div></div>';
  }

  async function render() {
    if (!el) return;
    var box = el.querySelector('#sbcap-box');
    var keepStatus = el.querySelector('.sbcap-status');
    var statusText = keepStatus ? keepStatus.textContent : '';
    var statusErr = keepStatus ? keepStatus.classList.contains('err') : false;
    var typed = el.querySelector('#sbcap-input') ? el.querySelector('#sbcap-input').value : '';

    var rows = (await allRows()).filter(function (r) { return !r.deleted_at; })
      .sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
    var unsent = (await allRows()).filter(function (r) { return r._dirty; }).length;

    var head = '<div class="sbcap-head"><div class="sbcap-grow"><h3>📥 Captures</h3>' +
      '<div class="sbcap-sub">Shared with your Second Brain devices · ' + rows.length + (rows.length === 1 ? ' item' : ' items') + '</div></div>' +
      '<button class="sbcap-btn primary" id="sbcap-sync" title="Send what is waiting and get the latest"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Syncing…' : '⟳ Sync') + (unsent ? '<span class="sbcap-count">' + unsent + '</span>' : '') + '</button>' +
      '<button class="sbcap-x" id="sbcap-close" title="Close">&times;</button></div>';

    var addForm = '<div class="sbcap-add" id="sbcap-add">' +
      '<input type="file" id="sbcap-file" accept="image/*" hidden>' +
      '<button class="sbcap-btn" id="sbcap-photo" title="Add a picture (you can also paste or drop one)">📷</button>' +
      '<textarea class="sbcap-field" id="sbcap-input" rows="1" placeholder="Throw in an idea, link, note or picture…"></textarea>' +
      '<button class="sbcap-btn primary" id="sbcap-addbtn">Add</button></div>' +
      (pendingPhoto ? '<div class="sbcap-pending">' + (photoSrc(pendingPhoto) ? '<img src="' + photoSrc(pendingPhoto) + '" alt="">' : '🖼️') +
        '<span>' + esc(pendingPhoto.image_name) + '</span><button class="sbcap-btn sm" id="sbcap-unphoto">Remove</button></div>' : '');

    var body = addForm + '<div class="sbcap-status"></div>' +
      (rows.length ? '<div class="sbcap-list">' + rows.map(itemHtml).join('') + '</div>'
        : '<div class="sbcap-empty"><div>📥</div>Nothing here yet. Add something above, or press Sync to get what your other devices captured.</div>');
    box.innerHTML = head + body;
    say(statusText, statusErr);
    var input = el.querySelector('#sbcap-input');
    if (input) input.value = typed;
    wire(rows);
  }

  function wire(rows) {
    var byId = function (id) { return rows.filter(function (r) { return r.sync_id === id; })[0]; };
    var q = function (s) { return el.querySelector(s); };
    q('#sbcap-close').onclick = close;

    q('#sbcap-sync').onclick = sync;

    var input = q('#sbcap-input');
    var grow = function () { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 180) + 'px'; };
    input.oninput = grow; grow();
    input.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } };
    q('#sbcap-addbtn').onclick = add;

    var pick = async function (file) {
      var photo = await readPhoto(file);
      if (photo) { pendingPhoto = photo; render(); }
    };
    var fileInput = q('#sbcap-file');
    q('#sbcap-photo').onclick = function () { fileInput.click(); };
    fileInput.onchange = function () { var f = fileInput.files[0]; fileInput.value = ''; pick(f); };
    input.onpaste = function (e) {
      var f = Array.prototype.filter.call((e.clipboardData && e.clipboardData.files) || [], function (x) { return x.type.startsWith('image/'); })[0];
      if (f) { e.preventDefault(); pick(f); }
    };
    var form = q('#sbcap-add');
    form.ondragover = function (e) { e.preventDefault(); form.classList.add('dragging'); };
    form.ondragleave = function () { form.classList.remove('dragging'); };
    form.ondrop = function (e) {
      e.preventDefault(); form.classList.remove('dragging');
      pick(Array.prototype.filter.call((e.dataTransfer && e.dataTransfer.files) || [], function (x) { return x.type.startsWith('image/'); })[0]);
    };
    if (q('#sbcap-unphoto')) q('#sbcap-unphoto').onclick = function () { pendingPhoto = null; render(); };

    el.querySelectorAll('.sbcap-item').forEach(function (item) {
      var row = byId(item.dataset.id);
      if (!row) return;
      var on = function (sel, fn) { var b = item.querySelector(sel); if (b) b.onclick = fn; };
      on('[data-open-photo]', function () { openPhoto(row); });
      on('[data-download]', function () { downloadPhoto(row); });
      on('[data-edit]', function () { editing = { id: row.sync_id, photo: undefined }; render(); });
      on('[data-delete]', function () { remove(row); });
      on('[data-edit-cancel]', function () { editing = null; render(); });
      on('[data-edit-unphoto]', function () { editing.photo = null; keepEditText(item); render(); });
      on('[data-edit-photo]', function () {
        var f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*';
        f.onchange = async function () {
          var photo = await readPhoto(f.files[0]);
          if (photo) { editing.photo = photo; keepEditText(item); render(); }
        };
        f.click();
      });
      on('[data-edit-save]', function () { saveEdit(row, item.querySelector('[data-edit-text]').value); });
      var ta = item.querySelector('[data-edit-text]');
      if (ta) {
        if (editing.text !== undefined) ta.value = editing.text;
        ta.focus();
      }
    });
  }
  function keepEditText(item) {
    var ta = item.querySelector('[data-edit-text]');
    if (ta && editing) editing.text = ta.value;
  }

  async function add() {
    var input = el.querySelector('#sbcap-input');
    var content = input.value.trim();
    if (!content && !pendingPhoto) return input.focus();
    var now = new Date().toISOString();
    var photo = pendingPhoto || {};
    await putRow({
      sync_id: uuid(), content: content, source: 'homer', status: 'pending', category: null, tags: [],
      error: null, processed_at: null,
      image_name: photo.image_name || null, image_type: photo.image_type || null, image_data: photo.image_data || null,
      created_at: now, updated_at: now, deleted_at: null, _dirty: true,
    });
    pendingPhoto = null;
    input.value = '';
    countDirty();
    say('Saved here. Press Sync to send it to your other devices.');
    await render();
    el.querySelector('#sbcap-input').focus();
  }

  async function saveEdit(row, text) {
    var photo = editing && editing.photo;
    var content = String(text || '').trim();
    var next = Object.assign({}, row, { content: content, updated_at: new Date().toISOString(), _dirty: true });
    if (photo !== undefined) {
      next.image_name = photo ? photo.image_name : null;
      next.image_type = photo ? photo.image_type : null;
      next.image_data = photo ? photo.image_data : null;
    }
    if (!next.content && !next.image_data) return say('A capture needs some text or a picture.', true);
    await putRow(next);
    editing = null;
    countDirty();
    say('Edited. Press Sync to send the change.');
    render();
  }

  async function remove(row) {
    if (!confirm('Delete this capture? It is removed from your other devices on the next Sync.')) return;
    // Never reached the hub: nothing to tell the other devices.
    if (!row.hub_seq && !row._sent) await deleteRow(row.sync_id);
    else {
      var now = new Date().toISOString();
      await putRow(Object.assign({}, row, { deleted_at: now, updated_at: now, _dirty: true }));
    }
    countDirty();
    render();
  }

  function openPhoto(row) {
    var src = photoSrc(row);
    if (!src) return;
    var lb = document.createElement('div');
    lb.id = 'sbcap-lightbox';
    lb.innerHTML = '<img alt=""><button class="sbcap-btn">⬇ Download</button>';
    lb.querySelector('img').src = src;
    lb.querySelector('button').onclick = function (e) { e.stopPropagation(); downloadPhoto(row); };
    var shut = function () { lb.remove(); document.removeEventListener('keydown', onKey, true); };
    var onKey = function (e) { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
    lb.onclick = shut;
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(lb);
  }

  function rerender() { if (el && el.style.display === 'flex') render(); }

  // The panel's Sync button: send what is waiting, then get the latest.
  async function sync() {
    if (busy) return;
    busy = true; await render();
    try {
      say('Sending…');
      var res = await push();
      say('Getting the latest…');
      await pull();
      if (res.failed.length) say(res.failed.length + ' could not be sent (' + res.failed[0] + '). They stay here; try Sync again.', true);
      else say(res.sent ? 'Sent ' + res.sent + ' to your other devices.' : 'Up to date.');
    } catch (err) { say(err.message || String(err), true); }
    busy = false; render(); countDirty();
  }

  // For the Sync & Backup panel (app-shell runSync). Errors are thrown so it
  // can log them; what was not sent stays waiting.
  var dirtyCount = 0;
  function countDirty() {
    return allRows().then(function (rows) {
      dirtyCount = rows.filter(function (r) { return r._dirty; }).length;
      return dirtyCount;
    }).catch(function () { return dirtyCount; });
  }
  window._homerCapturesPush = function () {
    return push().then(function (res) {
      rerender(); countDirty();
      if (res.failed.length) throw new Error(res.failed.length + ' capture(s) not sent: ' + res.failed[0]);
      return res;
    });
  };
  window._homerCapturesPull = function () { return pull().then(function () { rerender(); countDirty(); }); };
  window._homerCapturesDirtyCount = function () { return dirtyCount; };
  countDirty();

  function open() {
    injectCss();
    if (!el) {
      el = document.createElement('div');
      el.id = 'sbcap-overlay';
      el.innerHTML = '<div id="sbcap-box"></div>';
      el.addEventListener('click', function (e) { if (e.target === el) close(); });
      // Keep Homer's tab-swipe gesture from firing underneath.
      ['touchstart', 'touchmove', 'touchend'].forEach(function (t) {
        el.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true });
      });
      document.body.appendChild(el);
    }
    el.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    render().then(function () {
      var input = el.querySelector('#sbcap-input');
      if (input && window.innerWidth > 900) input.focus();
    });
  }
  function close() {
    if (!el) return;
    el.style.display = 'none';
    document.body.style.overflow = '';
    editing = null;
  }

  window.openSbCaptures = open;

  // ── Entry points ──────────────────────────────────────────────────────
  // The phone menu's "Capture" tile opens this instead of the older quick
  // capture; it runs in the capture phase so the earlier handlers never see it.
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('#msheet-qa-capture,#sbcap-sb-btn');
    if (!t) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var sheet = document.getElementById('mobile-sheet');
    if (sheet) sheet.classList.remove('open');
    open();
  }, true);
  document.addEventListener('keydown', function (e) {
    if (el && el.style.display === 'flex' && e.key === 'Escape' && !document.getElementById('sbcap-lightbox')) {
      if (editing) { editing = null; render(); } else close();
      e.stopPropagation();
    }
    if (e.altKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) { e.preventDefault(); open(); }
  }, true);
})();

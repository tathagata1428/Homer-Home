/* Homer — Inbox (= Second Brain Captures)
 *
 * Homer's Inbox and secondbrain's Captures are one list: the server bridges
 * the inbox field (ls:homer-inbox) to the hub's captures table
 * (lib/hub-bridge.js). This panel shows that list — what was captured here,
 * on the Homer phone app, and in secondbrain on the phone, PC or web — and
 * adds text, links and pictures to it.
 *
 * Like the rest of Homer (HOMER_SYNC_ON_DEMAND), nothing moves until a Sync
 * is asked for: the panel's Sync button runs the same Sync Now as the Sync &
 * Backup panel. Items are written to localStorage['homer-inbox'] like any
 * inbox edit (queued until Sync); deletions are tombstoned
 * (window._homerInboxTombstone) so a merge never brings them back.
 *
 * Pictures don't fit in that blob: they wait in IndexedDB and go to the hub
 * through /api/sb-captures (functions/api/sb-captures.js) once their item
 * has reached it; a picture captured elsewhere is fetched from there when
 * shown. app-shell runSync calls _homerCapturesPush / _homerCapturesPull. */
(function () {
  'use strict';

  var API = '/api/sb-captures';
  var KEY = 'homer-inbox';
  var DB_NAME = 'homer-inbox-pictures';
  // The first version of this panel kept its own list here (migrated once).
  var OLD_DB_NAME = 'homer-sb-captures';
  // Same ceiling as Second Brain's own clients: a picture travels as base64
  // inside its row and the hub refuses rows over 32 MB.
  var MAX_PHOTO_BYTES = 22 * 1024 * 1024;

  // ── Storage ───────────────────────────────────────────────────────────
  // images: { id (inbox item id), image_name, image_type, image_data,
  //           pending: not sent yet, removed: the picture was taken off }
  //
  // An open that never answers (an upgrade blocked by another tab running an
  // older copy of this script) must not leave the panel blank: give up after
  // a few seconds; the panel still works, just without local pictures.
  function openIdb(name, version, upgrade) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var finish = function (fn, v) { if (!done) { done = true; clearTimeout(timer); fn(v); } };
      var timer = setTimeout(function () { finish(reject, new Error('picture storage is busy (close other Homer tabs)')); }, 4000);
      var req = version ? indexedDB.open(name, version) : indexedDB.open(name);
      if (upgrade) req.onupgradeneeded = function () { upgrade(req.result); };
      req.onsuccess = function () {
        var db = req.result;
        // Let a newer copy of this script in another tab upgrade it.
        db.onversionchange = function () { db.close(); dbPromise = null; };
        if (done) db.close(); else finish(resolve, db);
      };
      req.onerror = function () { finish(reject, req.error); };
      req.onblocked = function () { finish(reject, new Error('picture storage is busy (close other Homer tabs)')); };
    });
  }
  var dbPromise = null;
  function openDb() {
    if (!dbPromise) {
      dbPromise = openIdb(DB_NAME, 1, function (db) {
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'id' });
      }).catch(function (err) { dbPromise = null; throw err; });
    }
    return dbPromise;
  }
  function tx(store, mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(store, mode);
        var req = fn(t.objectStore(store));
        t.oncomplete = function () { resolve(req && 'result' in req ? req.result : undefined); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }
  function getImage(id) { return tx('images', 'readonly', function (s) { return s.get(String(id)); }); }
  function allImages() { return tx('images', 'readonly', function (s) { return s.getAll(); }); }
  function putImage(rec) { return tx('images', 'readwrite', function (s) { s.put(Object.assign({}, rec, { id: String(rec.id) })); }); }
  function dropImage(id) { return tx('images', 'readwrite', function (s) { s.delete(String(id)); }); }

  function safeJson(text, fallback) { try { var v = JSON.parse(text); return v == null ? fallback : v; } catch (e) { return fallback; } }
  // Items deleted here, to delete in Second Brain on the next Sync (the
  // server never deletes a capture just because a saved inbox lacks it).
  // Local only: Storage.prototype.setItem skips Homer's sync patches.
  var DELETE_QUEUE_KEY = 'homer-inbox-delete-queue';
  function deleteQueue() { var v = safeJson(localStorage.getItem(DELETE_QUEUE_KEY), []); return Array.isArray(v) ? v : []; }
  function setDeleteQueue(ids) { try { Storage.prototype.setItem.call(localStorage, DELETE_QUEUE_KEY, JSON.stringify(ids)); } catch (e) {} }
  function readInbox() { var v = safeJson(localStorage.getItem(KEY), []); return Array.isArray(v) ? v : []; }
  // Through localStorage.setItem on purpose: Homer's patches queue it for the
  // next Sync like every other inbox edit.
  function writeInbox(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('homer-inbox-changed'));
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
  // Inbox items carry their time in whichever key the client that made them used.
  function itemTime(x) {
    return Number(x.createdAt) || Date.parse(x.ts || x.date || '') || (/^\d{12,}$/.test(String(x.id)) ? Number(x.id) : 0);
  }
  function itemText(x) { return [String(x.text || '').trim(), String(x.note || '').trim()].filter(Boolean).join('\n'); }
  function splitText(content) {
    var c = String(content || '').replace(/\r\n/g, '\n').trim();
    var cut = c.indexOf('\n');
    return cut < 0 ? { text: c, note: '' } : { text: c.slice(0, cut).trim(), note: c.slice(cut + 1).trim() };
  }
  function timeAgo(t) {
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
  var DRAWABLE = /^image\/(png|jpe?g|gif|webp|bmp|avif)$/i;
  function photoSrc(img) {
    if (!img || !img.image_data || img.removed) return null;
    var type = String(img.image_type || 'image/jpeg').toLowerCase();
    return DRAWABLE.test(type) ? 'data:' + type + ';base64,' + img.image_data : null;
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
  function downloadPhoto(id, img) {
    var bin = atob(img.image_data), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([bytes], { type: img.image_type || 'application/octet-stream' }));
    var ext = String(img.image_type || 'image/jpeg').split('/')[1] || 'jpg';
    var a = document.createElement('a');
    a.href = url;
    a.download = img.image_name && !/^photo\./i.test(img.image_name) ? img.image_name : 'capture-' + String(id).slice(0, 8) + '.' + ext;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ── Server ────────────────────────────────────────────────────────────
  // The Homer session, refreshed first when it is about to run out.
  function authHeader() {
    var fresh = window.__db && window.__db.auth ? window.__db.auth.getSession().catch(function () {}) : Promise.resolve();
    return fresh.then(function () { return typeof window.dbAuthHeader === 'function' ? window.dbAuthHeader() : null; });
  }
  function call(body) {
    return authHeader().then(function (auth) {
      if (!auth) throw new Error('Sign in to Homer (Account) to sync the inbox.');
      return fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify(body),
        cache: 'no-store'
      });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (r.status === 401) throw new Error('Your Homer sign-in has ended. Sign in again (Account) to sync the inbox.');
        if (r.status === 409 && data.notYet) return data;
        if (!r.ok) throw new Error(data.error || ('Homer answered ' + r.status));
        return data;
      });
    });
  }

  // Sends deletes and pictures that are waiting. An item's picture can only follow once
  // the item itself has reached Second Brain (the inbox goes out first in
  // the same Sync, a moment earlier), so a "not yet" is retried briefly and
  // then left for the next Sync.
  async function pushImages() {
    var sent = 0, notYet = 0, failed = [];
    var gone = deleteQueue();
    if (gone.length) {
      try {
        await call({ action: 'delete', ids: gone });
        setDeleteQueue(deleteQueue().filter(function (id) { return gone.indexOf(id) < 0; }));
      } catch (err) { failed.push(err.message); }
    }
    var waiting = (await allImages()).filter(function (r) { return r.pending; });
    var live = {};
    readInbox().forEach(function (x) { live[String(x.id)] = true; });
    for (var i = 0; i < waiting.length; i++) {
      var rec = waiting[i];
      if (!live[rec.id]) { await dropImage(rec.id); continue; }
      var image = rec.removed ? null : { image_name: rec.image_name, image_type: rec.image_type, image_data: rec.image_data };
      var res = null;
      for (var attempt = 0; attempt < 5; attempt++) {
        try { res = await call({ action: 'image-put', id: rec.id, image: image }); }
        catch (err) { res = { error: err.message }; break; }
        if (!res.notYet) break;
        await wait(2500);
      }
      if (res && res.ok) {
        sent++;
        if (rec.removed) await dropImage(rec.id);
        else await putImage(Object.assign({}, rec, { pending: false }));
      } else if (res && res.notYet) notYet++;
      else failed.push((res && res.error) || 'not sent');
    }
    await countWaiting();
    return { sent: sent, notYet: notYet, failed: failed };
  }

  // Pulls Second Brain now (the server would otherwise wait up to 15 s
  // between hub pulls) and merges the result into the local inbox.
  async function refresh() {
    var data = await call({ action: 'refresh' });
    if (typeof window._homerApplyRemoteInbox === 'function') window._homerApplyRemoteInbox(data.value);
    rerender();
  }

  // A picture captured elsewhere (or sent from here earlier), fetched when shown.
  var fetching = {};
  function loadImage(id) {
    if (fetching[id]) return fetching[id];
    fetching[id] = call({ action: 'image-get', id: id }).then(function (data) {
      if (!data.image) return null;
      var rec = Object.assign({ id: id, pending: false }, data.image);
      return putImage(rec).then(function () { return rec; });
    }).catch(function () { return null; }).then(function (rec) { delete fetching[id]; return rec; });
    return fetching[id];
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
      '.sbcap-item.done .sbcap-text{opacity:.55;text-decoration:line-through;}',
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

  // Kept here, not read back from the page: renders overlap (a Sync's pull
  // re-renders while the Sync itself still has a message to show).
  var statusMsg = '', statusErr = false;
  function say(msg, isErr) {
    statusMsg = msg || '';
    statusErr = !!isErr;
    var s = el && el.querySelector('.sbcap-status');
    if (!s) return;
    s.textContent = statusMsg;
    s.classList.toggle('err', statusErr);
  }

  function linkify(text) {
    return esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  var SOURCE_LABEL = { ios: '📱 iPhone', android: '📱 Phone', mobile: '📱 Phone', web: '🌐 Web', homer: '🏠 Homer', desktop: '🖥️ Desktop' };
  function sourceLabel(src) { return src ? (SOURCE_LABEL[src] || '🖥️ ' + src) : '🏠 Homer'; }

  // Not on Second Brain yet: never came back from it (no status), or a
  // picture still waiting.
  function isUnsent(x, img) { return !x.status || !!(img && img.pending); }

  function itemHtml(x, img) {
    var id = String(x.id);
    var shown = img && !img.removed ? img : null;
    var hasPic = shown || (x.hasImage && !(img && img.removed));
    if (editing && editing.id === id) {
      var p = editing.photo === undefined ? shown : editing.photo;
      var src = photoSrc(p);
      var keepsPic = editing.photo === undefined ? hasPic : !!editing.photo;
      return '<div class="sbcap-item" data-id="' + esc(id) + '"><div class="sbcap-edit">' +
        '<textarea class="sbcap-field" data-edit-text rows="3">' + esc(editing.text !== undefined ? editing.text : itemText(x)) + '</textarea>' +
        (keepsPic ? '<div class="sbcap-photo">' + (src ? '<img src="' + src + '" alt="">' : '<span class="sbcap-sub">🖼️ Picture</span>') + '</div>' : '') +
        '<div class="sbcap-row">' +
          '<button class="sbcap-btn sm" data-edit-photo>📷 ' + (keepsPic ? 'Replace picture' : 'Add picture') + '</button>' +
          (keepsPic ? '<button class="sbcap-btn sm" data-edit-unphoto>Remove picture</button>' : '') +
          '<span style="flex:1"></span>' +
          '<button class="sbcap-btn sm" data-edit-cancel>Cancel</button>' +
          '<button class="sbcap-btn sm primary" data-edit-save>Save</button>' +
        '</div></div></div>';
    }
    var text = itemText(x);
    var srcImg = photoSrc(shown);
    var unsent = isUnsent(x, img);
    return '<div class="sbcap-item' + (unsent ? ' unsent' : '') + (x.done ? ' done' : '') + '" data-id="' + esc(id) + '">' +
      (text ? '<div class="sbcap-text">' + linkify(text) + '</div>' : '') +
      (hasPic ? '<div class="sbcap-photo">' +
        (srcImg ? '<img src="' + srcImg + '" alt="" data-open-photo title="See it full size">'
          : shown ? '<span class="sbcap-sub">Picture in a format this browser cannot show.</span>'
          : '<span class="sbcap-sub" data-load-photo>🖼️ Loading picture…</span>') +
        (shown ? '<button class="sbcap-btn sm" data-download>⬇ Download</button>' : '') + '</div>' : '') +
      '<div class="sbcap-meta">' +
        (unsent ? '<span class="sbcap-badge unsent">not sent</span>' : '') +
        (x.status ? '<span class="sbcap-badge ' + (x.status === 'done' || x.status === 'error' ? x.status : '') + '">' + esc(x.status) + '</span>' : '') +
        (x.category ? '<span class="sbcap-badge">' + esc(x.category) + '</span>' : '') +
        (x.type && x.type !== 'thought' ? '<span class="sbcap-badge">' + esc(x.type) + '</span>' : '') +
        (Array.isArray(x.tags) ? x.tags.slice(0, 4).map(function (t) { return '<span class="sbcap-badge">#' + esc(t) + '</span>'; }).join('') : '') +
        '<span>' + sourceLabel(x.source) + ' · ' + esc(timeAgo(itemTime(x))) + '</span>' +
        '<span class="sbcap-grow"></span>' +
        '<button class="sbcap-btn sm" data-edit>Edit</button>' +
        '<button class="sbcap-btn sm danger" data-delete title="Delete">✕</button>' +
      '</div></div>';
  }

  async function render() {
    if (!el) return;
    var box = el.querySelector('#sbcap-box');
    var images = {};
    (await allImages().catch(function () { return []; })).forEach(function (r) { images[r.id] = r; });
    // Read after the await: renders overlap, and the newest state must win.
    var typed = el.querySelector('#sbcap-input') ? el.querySelector('#sbcap-input').value : '';
    var items = readInbox().filter(function (x) { return x && x.id != null; })
      .sort(function (a, b) { return itemTime(b) - itemTime(a); });
    var waiting = items.filter(function (x) { return isUnsent(x, images[String(x.id)]); }).length + deleteQueue().length;

    box.innerHTML =
      '<div class="sbcap-head"><div class="sbcap-grow"><h3>📥 Inbox</h3>' +
        '<div class="sbcap-sub">Same list as Captures in Second Brain · ' + items.length + (items.length === 1 ? ' item' : ' items') + '</div></div>' +
        '<button class="sbcap-btn primary" id="sbcap-sync" title="Send what is waiting and get the latest (same as Sync Now)"' + (busy ? ' disabled' : '') + '>' +
          (busy ? 'Syncing…' : '⟳ Sync') + (waiting && !busy ? '<span class="sbcap-count">' + waiting + '</span>' : '') + '</button>' +
        '<button class="sbcap-x" id="sbcap-close" title="Close">&times;</button></div>' +
      '<div class="sbcap-add" id="sbcap-add">' +
        '<input type="file" id="sbcap-file" accept="image/*" hidden>' +
        '<button class="sbcap-btn" id="sbcap-photo" title="Add a picture (you can also paste or drop one)">📷</button>' +
        '<textarea class="sbcap-field" id="sbcap-input" rows="1" placeholder="Throw in an idea, link, note or picture…"></textarea>' +
        '<button class="sbcap-btn primary" id="sbcap-addbtn">Add</button></div>' +
      (pendingPhoto ? '<div class="sbcap-pending">' + (photoSrc(pendingPhoto) ? '<img src="' + photoSrc(pendingPhoto) + '" alt="">' : '🖼️') +
        '<span>' + esc(pendingPhoto.image_name) + '</span><button class="sbcap-btn sm" id="sbcap-unphoto">Remove</button></div>' : '') +
      '<div class="sbcap-status"></div>' +
      (items.length ? '<div class="sbcap-list">' + items.map(function (x) { return itemHtml(x, images[String(x.id)]); }).join('') + '</div>'
        : '<div class="sbcap-empty"><div>📥</div>Nothing here yet. Add something above, or press Sync to get what your other devices captured.</div>');
    say(statusMsg, statusErr);
    el.querySelector('#sbcap-input').value = typed;
    wire(items, images);
  }
  function rerender() { if (el && el.style.display === 'flex') render(); }

  function wire(items, images) {
    var byId = function (id) { return items.filter(function (x) { return String(x.id) === id; })[0]; };
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

    var toLoad = [];
    el.querySelectorAll('.sbcap-item').forEach(function (node) {
      var id = node.dataset.id, x = byId(id), img = images[id];
      if (!x) return;
      var on = function (sel, fn) { var b = node.querySelector(sel); if (b) b.onclick = fn; };
      on('[data-open-photo]', function () { openPhoto(id, img); });
      on('[data-download]', function () { downloadPhoto(id, img); });
      on('[data-edit]', function () { editing = { id: id, photo: undefined }; render(); });
      on('[data-delete]', function () { remove(x); });
      on('[data-edit-cancel]', function () { editing = null; render(); });
      on('[data-edit-unphoto]', function () { keepEditText(node); editing.photo = null; render(); });
      on('[data-edit-photo]', function () {
        var f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*';
        f.onchange = async function () {
          var photo = await readPhoto(f.files[0]);
          if (photo) { keepEditText(node); editing.photo = photo; render(); }
        };
        f.click();
      });
      on('[data-edit-save]', function () { saveEdit(x, node.querySelector('[data-edit-text]').value); });
      var ta = node.querySelector('[data-edit-text]');
      if (ta) ta.focus();
      if (node.querySelector('[data-load-photo]')) toLoad.push(id);
    });
    // Pictures from other devices, a few at a time.
    if (toLoad.length) {
      Promise.all(toLoad.slice(0, 6).map(loadImage)).then(function (recs) {
        if (recs.some(Boolean)) rerender();
        else el.querySelectorAll('[data-load-photo]').forEach(function (n) { n.textContent = '🖼️ Picture (shows after a Sync)'; });
      });
    }
  }
  function keepEditText(node) {
    var ta = node.querySelector('[data-edit-text]');
    if (ta && editing) editing.text = ta.value;
  }

  async function add() {
    var input = el.querySelector('#sbcap-input');
    var parts = splitText(input.value);
    if (!parts.text && !parts.note && !pendingPhoto) return input.focus();
    var now = Date.now();
    var item = {
      id: uuid(), text: parts.text, note: parts.note, type: 'thought', source: 'homer',
      ts: new Date(now).toISOString(), createdAt: now, done: false
    };
    if (pendingPhoto) {
      item.hasImage = true;
      try { await putImage(Object.assign({ id: item.id, pending: true }, pendingPhoto)); }
      catch (err) { return say('The picture could not be saved: ' + err.message, true); }
    }
    var list = readInbox();
    list.unshift(item);
    writeInbox(list);
    pendingPhoto = null;
    input.value = '';
    await countWaiting();
    say('Saved. Press Sync to send it to your other devices.');
    await render();
    el.querySelector('#sbcap-input').focus();
  }

  async function saveEdit(x, content) {
    var parts = splitText(content);
    var photo = editing && editing.photo;
    var id = String(x.id);
    var img = await getImage(id).catch(function () { return null; });
    var willHavePic = photo === undefined ? !!((img && !img.removed) || (x.hasImage && !(img && img.removed))) : !!photo;
    if (!parts.text && !parts.note && !willHavePic) return say('An item needs some text or a picture.', true);
    try {
      if (photo) await putImage(Object.assign({ id: id, pending: true }, photo));
      else if (photo === null) {
        // Never sent: nothing to take off the hub.
        if (img && img.pending && !x.status) await dropImage(id);
        else await putImage({ id: id, pending: true, removed: true });
      }
    } catch (err) { return say('The picture could not be saved: ' + err.message, true); }
    var list = readInbox().map(function (it) {
      if (String(it.id) !== id) return it;
      var next = Object.assign({}, it, { text: parts.text, note: parts.note, editedAt: Date.now() });
      if (photo !== undefined) next.hasImage = !!photo;
      return next;
    });
    writeInbox(list);
    editing = null;
    await countWaiting();
    say('Edited. Press Sync to send the change.');
    render();
  }

  async function remove(x) {
    if (!confirm('Delete this item? It is removed from your other devices on the next Sync.')) return;
    var id = String(x.id);
    if (typeof window._homerInboxTombstone === 'function') window._homerInboxTombstone(id);
    var queue = deleteQueue();
    if (queue.indexOf(id) < 0) setDeleteQueue(queue.concat([id]));
    writeInbox(readInbox().filter(function (it) { return String(it.id) !== id; }));
    await dropImage(id).catch(function () {});
    await countWaiting();
    render();
  }

  function openPhoto(id, img) {
    var src = photoSrc(img);
    if (!src) return;
    var lb = document.createElement('div');
    lb.id = 'sbcap-lightbox';
    lb.innerHTML = '<img alt=""><button class="sbcap-btn">⬇ Download</button>';
    lb.querySelector('img').src = src;
    lb.querySelector('button').onclick = function (e) { e.stopPropagation(); downloadPhoto(id, img); };
    var shut = function () { lb.remove(); document.removeEventListener('keydown', onKey, true); };
    var onKey = function (e) { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
    lb.onclick = shut;
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(lb);
  }

  // The panel's Sync button is Homer's Sync Now (which calls the hooks
  // below); without it, just the inbox.
  async function sync() {
    if (busy) return;
    busy = true; await render();
    say('Syncing…');
    lastPush = null;
    try {
      if (typeof window.homerSyncNow === 'function') {
        await window.homerSyncNow('both');
      } else {
        if (typeof window._homerSyncInboxNow === 'function') await window._homerSyncInboxNow();
        lastPush = await pushImages();
        await refresh();
      }
      say(syncSummary());
    } catch (err) { say(err.message || String(err), true); }
    busy = false; await countWaiting(); render();
  }
  var lastPush = null, lastError = '';
  function syncSummary() {
    if (lastError) { var e = lastError; lastError = ''; return e; }
    var waitingNow = readInbox().filter(function (x) { return !x.status; }).length;
    if (lastPush && lastPush.failed.length) return lastPush.failed.length + ' picture(s) could not be sent (' + lastPush.failed[0] + '). Press Sync to try again.';
    if (lastPush && lastPush.notYet) return 'Synced. ' + lastPush.notYet + ' picture(s) go out on the next Sync, once their item has reached Second Brain.';
    if (waitingNow) return 'Synced, but ' + waitingNow + ' item(s) have not reached Second Brain yet. Press Sync again in a moment.';
    return 'Synced ✓';
  }

  // ── Hooks for Homer's Sync (app-shell runSync) ─────────────────────────
  var waitingCount = 0;
  function countWaiting() {
    return allImages().then(function (rows) {
      waitingCount = rows.filter(function (r) { return r.pending; }).length + deleteQueue().length;
      return waitingCount;
    }).catch(function () { return waitingCount; });
  }
  window._homerCapturesPush = function () {
    return pushImages().then(function (res) {
      lastPush = res;
      rerender();
      if (res.failed.length) throw new Error(res.failed.length + ' inbox picture(s) not sent: ' + res.failed[0]);
      return res;
    });
  };
  window._homerCapturesPull = function () {
    return refresh().catch(function (err) { lastError = err.message || String(err); throw err; });
  };
  // Field changes are counted by app-shell itself; this adds waiting pictures.
  window._homerCapturesDirtyCount = function () { return waitingCount; };

  // Items saved by the first version of this panel (its own store, not the
  // inbox) move into the inbox once.
  function migrateOldCaptures() {
    var listed = indexedDB.databases ? indexedDB.databases() : Promise.resolve([{ name: OLD_DB_NAME }]);
    var oldDb = null;
    return listed.then(function (dbs) {
      if (!dbs.some(function (d) { return d.name === OLD_DB_NAME; })) return [];
      // No version: opens what is there, so it never waits on an upgrade.
      return openIdb(OLD_DB_NAME, 0).then(function (db) {
        oldDb = db;
        if (!db.objectStoreNames.contains('captures')) return [];
        return new Promise(function (resolve, reject) {
          var req = db.transaction('captures', 'readonly').objectStore('captures').getAll();
          req.onsuccess = function () { resolve(req.result || []); };
          req.onerror = function () { reject(req.error); };
        });
      });
    }).then(function (rows) {
      var keep = (rows || []).filter(function (r) { return r && r._dirty && !r.deleted_at; });
      if (!rows || !rows.length) return;
      var list = readInbox();
      var have = {};
      list.forEach(function (x) { have[String(x.id)] = true; });
      var chain = Promise.resolve();
      keep.forEach(function (r) {
        if (have[r.sync_id]) return;
        var parts = splitText(r.content);
        var t = Date.parse(r.created_at) || Date.now();
        list.unshift({ id: r.sync_id, text: parts.text, note: parts.note, type: 'thought', source: 'homer', ts: new Date(t).toISOString(), createdAt: t, done: false, hasImage: !!r.image_data });
        if (r.image_data) chain = chain.then(function () { return putImage({ id: r.sync_id, image_name: r.image_name, image_type: r.image_type, image_data: r.image_data, pending: true }); });
      });
      return chain.then(function () {
        if (keep.length) writeInbox(list);
        // Done with it; an older tab still holding it just delays the delete.
        if (oldDb) { oldDb.close(); oldDb = null; }
        indexedDB.deleteDatabase(OLD_DB_NAME);
      });
    }).catch(function () {}).then(function () {
      if (oldDb) oldDb.close();
      return countWaiting();
    });
  }

  function open() {
    injectCss();
    if (!el) {
      el = document.createElement('div');
      el.id = 'sbcap-overlay';
      el.innerHTML = '<div id="sbcap-box" class="sbcap-panel"></div>';
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
  window.addEventListener('homer-inbox-changed', rerender);
  migrateOldCaptures();

  // ── Entry points ──────────────────────────────────────────────────────
  // This panel is the Inbox: the older inbox side panel's opener points here,
  // set again after load in case that script initialises later.
  function claimInbox() { window._homerOpenInbox = open; }
  claimInbox();
  document.addEventListener('DOMContentLoaded', claimInbox);
  window.addEventListener('load', function () { setTimeout(claimInbox, 0); });
  // The phone menu's Capture and Inbox tiles and the sidebar item open it;
  // capture phase, so the older handlers never see these clicks.
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('#msheet-qa-capture,#msheet-qa-inbox,#sbcap-sb-btn');
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

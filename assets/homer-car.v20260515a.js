/* ====================================================================
 * Homer Car Tracker  v20260515a
 * Track vehicle documents (insurance, vignette, ITP), maintenance,
 * and fuel log. Supabase sync included.
 * Data key: 'homer-car'  /  Supabase field_id: 'ls:homer-car'
 * ==================================================================== */
(function () {
  'use strict';

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function safeJson(s, fb) { try { return s ? JSON.parse(s) : fb; } catch (_) { return fb; } }
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function addDays(dateStr, n) {
    var d = new Date(dateStr); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function daysUntil(dateStr) {
    if (!dateStr) return 9999;
    var now = new Date(); now.setHours(0,0,0,0);
    var exp = new Date(dateStr); exp.setHours(0,0,0,0);
    return Math.round((exp - now) / 86400000);
  }
  function fmtDate(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return parts[2] + '.' + parts[1] + '.' + parts[0];
  }
  function fmtMoney(n) {
    if (!n || n === 0) return '';
    return Number(n).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' lei';
  }

  var SB_FIELD_ID = 'ls:homer-car';
  var LS_KEY      = 'homer-car';   // kept for one-time migration only
  var CONTAINER_ID = 'tab-car';
  var TAB_KEY = 'car';

  /* ── IndexedDB storage (no quota limits) ──────────────────────────── */
  var IDB_NAME  = 'homer-car-db';
  var IDB_STORE = 'car';
  var IDB_KEY   = 'main';

  function emptyData() {
    return { vehicles: [], documents: [], maintenance: [], fuel: [] };
  }
  function openIDB(cb) {
    var req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = function(e) { e.target.result.createObjectStore(IDB_STORE); };
    req.onsuccess = function(e) { cb(null, e.target.result); };
    req.onerror   = function()  { cb(new Error('idb'), null); };
  }
  function loadFromIDB(cb) {
    openIDB(function(err, db) {
      if (err) { cb(emptyData()); return; }
      var req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = function() {
        var d = req.result || {};
        cb({ vehicles: d.vehicles||[], documents: d.documents||[], maintenance: d.maintenance||[], fuel: d.fuel||[] });
      };
      req.onerror = function() { cb(emptyData()); };
    });
  }
  function saveToIDB(data, cb) {
    openIDB(function(err, db) {
      if (err) { if (cb) cb(); return; }
      var tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(data, IDB_KEY);
      tx.oncomplete = function() { if (cb) cb(); };
      tx.onerror    = function() { if (cb) cb(); };
    });
  }

  /* ── Save ─────────────────────────────────────────────────────────── */
  function save(data) {
    state.data = data;
    saveToIDB(data);
    pushToSupabase(data);
    // Also push via localStorage → queueLsFieldOp → CF Pages (works without Supabase session)
    if(isBogdan()) try{ localStorage.setItem('homer-car', JSON.stringify(data)); }catch(e){}
  }

  /* ── Supabase ─────────────────────────────────────────────────────── */
  function getSbClient() { return window.__supabase || null; }
  function getSbUid() {
    var sess = window.__sbSession || null;
    return sess && sess.user ? sess.user.id : null;
  }
  function isBogdan() {
    var u = localStorage.getItem('homer-auth-user');
    if (u && u.toLowerCase() === 'bogdan') return true;
    var sess = window.__sbSession;
    return !!(sess && sess.user && (sess.user.email || '').toLowerCase().includes('bogdan'));
  }
  function pushToSupabase(data) {
    if (!isBogdan()) return;
    var client = getSbClient(), uid2 = getSbUid();
    if (!client || !uid2) return;
    var ts = Date.now();
    client.from('field_state').upsert({
      user_id: uid2, field_id: SB_FIELD_ID, kind: 'json',
      value: JSON.stringify(data), client_ts: ts, server_ts: ts,
      client_seq: 0, device_id: 'web',
      updated_at: new Date(ts).toISOString(),
    }, { onConflict: 'user_id,field_id' });
  }
  function pullFromSupabase(cb) {
    if (!isBogdan()) { cb(null); return; }
    var client = getSbClient(), uid2 = getSbUid();
    if (!client || !uid2) { cb(null); return; }
    client.from('field_state')
      .select('value')
      .eq('user_id', uid2)
      .eq('field_id', SB_FIELD_ID)
      .single()
      .then(function(res) {
        if (res.data && res.data.value) cb(safeJson(res.data.value, null));
        else cb(null);
      }).catch(function() { cb(null); });
  }

  /* ── Document type helpers ────────────────────────────────────────── */
  var DOC_TYPES = [
    { key: 'insurance',      label: 'Car Insurance',    icon: '🛡️' },
    { key: 'ctp',            label: 'CTP / RCA',        icon: '⚖️' },
    { key: 'vignette',       label: 'Vignette',         icon: '🏷️' },
    { key: 'itp',            label: 'Tech Inspection',  icon: '🔧' },
    { key: 'registration',   label: 'Registration',     icon: '📋' },
    { key: 'tax',            label: 'Road Tax',         icon: '📜' },
    { key: 'driver_license', label: "Driver's License", icon: '🪪' },
    { key: 'id_card',        label: 'ID Card',          icon: '🆔' },
    { key: 'passport',       label: 'Passport',         icon: '📗' },
    { key: 'other',          label: 'Other',            icon: '📄' },
  ];
  var MAINT_TYPES = [
    { key: 'oil',         label: 'Oil Change',    icon: '🛢️' },
    { key: 'filters',     label: 'Filters',       icon: '🌀' },
    { key: 'tires',       label: 'Tires',         icon: '🔄' },
    { key: 'brakes',      label: 'Brakes',        icon: '🛑' },
    { key: 'belt',        label: 'Timing Belt',   icon: '⚙️' },
    { key: 'spark_plugs', label: 'Spark Plugs',   icon: '⚡' },
    { key: 'battery',     label: 'Battery',       icon: '🔋' },
    { key: 'ac',          label: 'A/C Service',   icon: '❄️' },
    { key: 'other',       label: 'Other',         icon: '🔩' },
  ];
  var FUEL_TYPES = ['petrol', 'diesel', 'electric', 'hybrid', 'lpg'];
  var BODY_TYPES = ['sedan', 'hatchback', 'suv', 'coupe', 'wagon', 'van', 'pickup', 'convertible'];
  var TRANSMISSIONS = ['manual', 'automatic', 'dsg', 'cvt'];
  var DRIVETRAINS = ['fwd', 'rwd', 'awd', '4wd'];

  function docTypeInfo(key) { return DOC_TYPES.find(function(d) { return d.key === key; }) || DOC_TYPES[4]; }
  function maintTypeInfo(key) { return MAINT_TYPES.find(function(m) { return m.key === key; }) || MAINT_TYPES[8]; }

  function urgencyClass(days) {
    if (days < 0)   return 'car-urg-expired';
    if (days <= 7)  return 'car-urg-critical';
    if (days <= 30) return 'car-urg-warn';
    return 'car-urg-ok';
  }
  function urgencyLabel(days) {
    if (days < 0)   return 'EXPIRED';
    if (days <= 7)  return days + ' days left';
    if (days <= 30) return days + ' days left';
    return days + ' days';
  }

  /* ── CSS ──────────────────────────────────────────────────────────── */
  var CSS = `
    #tab-car { padding:16px; }

    /* Header */
    .car-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; gap:12px; }
    .car-title-main { font-size:1.5rem; font-weight:900; letter-spacing:.04em; color:#e5e7eb; line-height:1.1; }
    .car-title-sub  { font-size:1.5rem; font-weight:900; letter-spacing:.04em; color:#60a5fa; line-height:1.1; }
    .car-title-bar  { width:40px; height:2px; background:linear-gradient(90deg,#60a5fa,#3b82f6); margin-top:6px; border-radius:1px; }
    .car-add-btn { display:flex; align-items:center; gap:6px; padding:9px 16px; border-radius:12px; border:none; background:linear-gradient(135deg,#3b82f6,#2563eb); color:#fff; font-size:.82rem; font-weight:700; cursor:pointer; flex-shrink:0; }
    .car-add-btn:hover { filter:brightness(1.12); }

    /* Vehicle dashboard card */
    .car-vehicle-card {
      background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.03));
      border:1px solid rgba(255,255,255,.1);
      border-radius:18px;
      padding:20px;
      margin-bottom:20px;
    }
    .car-vc-top { display:flex; align-items:flex-start; gap:14px; margin-bottom:14px; }
    .car-icon-box { width:52px;height:52px;border-radius:14px;background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.2);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0; }
    .car-vc-name { font-size:1.35rem; font-weight:800; color:#e5e7eb; line-height:1.1; }
    .car-vc-meta { font-size:.82rem; color:#60a5fa; font-weight:600; margin-top:3px; display:flex; gap:8px; align-items:center; }
    .car-plate { margin-left:auto; background:rgba(96,165,250,.1); border:1px solid rgba(96,165,250,.3); border-radius:8px; padding:5px 11px; font-size:.88rem; font-weight:800; color:#93c5fd; letter-spacing:.1em; white-space:nowrap; }
    .car-vc-divider { width:100%; height:1px; background:linear-gradient(90deg,rgba(255,255,255,.1),transparent); margin-bottom:14px; }
    .car-stats-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
    .car-stat-box { background:rgba(0,0,0,.2); border:1px solid rgba(255,255,255,.07); border-radius:10px; padding:10px 10px 8px; }
    .car-stat-icon-label { display:flex; align-items:center; gap:5px; margin-bottom:3px; }
    .car-stat-icon { font-size:.85rem; }
    .car-stat-label { font-size:.6rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#64748b; }
    .car-stat-value { font-size:.88rem; font-weight:700; color:#e5e7eb; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .car-vin-row { display:flex; align-items:center; gap:8px; background:rgba(0,0,0,.2); border-radius:8px; padding:7px 10px; margin-top:10px; }
    .car-vin-label { font-size:.7rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:.06em; white-space:nowrap; }
    .car-vin-val { font-size:.78rem; color:#94a3b8; font-family:monospace; letter-spacing:.04em; }

    /* Vehicle selector pills */
    .car-v-selector { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
    .car-v-pill { padding:5px 14px; border-radius:20px; border:1px solid; font-size:.78rem; cursor:pointer; transition:all .15s; }
    .car-v-pill.active { background:rgba(96,165,250,.12); border-color:rgba(96,165,250,.4); color:#60a5fa; font-weight:700; }
    .car-v-pill:not(.active) { background:rgba(255,255,255,.03); border-color:rgba(255,255,255,.08); color:#64748b; }

    /* Tabs */
    .car-tabs { display:flex; border-bottom:1px solid rgba(255,255,255,.08); margin-bottom:16px; }
    .car-tab-btn { flex:1; padding:10px; font-size:.78rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; background:none; border:none; border-bottom:2px solid transparent; color:#64748b; cursor:pointer; transition:all .15s; }
    .car-tab-btn.active { color:#60a5fa; border-bottom-color:#60a5fa; }
    .car-tab-btn:nth-child(2).active { color:#34d399; border-bottom-color:#34d399; }
    .car-tab-btn:nth-child(3).active { color:#fbbf24; border-bottom-color:#fbbf24; }

    /* Section header */
    .car-sec-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
    .car-sec-title { font-size:.68rem; font-weight:800; text-transform:uppercase; letter-spacing:.12em; color:rgba(255,255,255,.25); }
    .car-add-small { display:flex; align-items:center; gap:5px; padding:5px 12px; border-radius:20px; border:1px solid; font-size:.75rem; font-weight:700; cursor:pointer; background:none; transition:all .15s; }
    .car-add-doc   { border-color:rgba(96,165,250,.35); color:#60a5fa; }
    .car-add-doc:hover { background:rgba(96,165,250,.08); }
    .car-add-maint { border-color:rgba(52,211,153,.35); color:#34d399; }
    .car-add-maint:hover { background:rgba(52,211,153,.08); }
    .car-add-fuel  { border-color:rgba(251,191,36,.35); color:#fbbf24; }
    .car-add-fuel:hover { background:rgba(251,191,36,.08); }

    /* Document card */
    .car-doc-card { display:flex; align-items:center; gap:12px; border-radius:14px; padding:14px; margin-bottom:8px; cursor:pointer; transition:background .15s; border:1px solid; }
    .car-doc-card:hover { background:rgba(255,255,255,.03); }
    .car-urg-expired  { border-color:rgba(239,68,68,.35); }
    .car-urg-critical { border-color:rgba(239,68,68,.28); }
    .car-urg-warn     { border-color:rgba(251,191,36,.3); }
    .car-urg-ok       { border-color:rgba(255,255,255,.09); }
    .car-doc-icon { font-size:1.5rem; flex-shrink:0; }
    .car-doc-info { flex:1; min-width:0; }
    .car-doc-label { font-size:.9rem; font-weight:700; color:#e5e7eb; }
    .car-doc-expiry { font-size:.78rem; color:#64748b; margin-top:1px; }
    .car-doc-provider { font-size:.72rem; color:#475569; }
    .car-doc-right { display:flex; flex-direction:column; align-items:flex-end; gap:4px; }
    .car-urg-badge { font-size:.68rem; font-weight:800; padding:3px 9px; border-radius:20px; letter-spacing:.04em; border:1px solid; white-space:nowrap; }
    .car-urg-expired  .car-urg-badge  { color:#ef4444; background:rgba(239,68,68,.1); border-color:rgba(239,68,68,.4); }
    .car-urg-critical .car-urg-badge  { color:#f87171; background:rgba(239,68,68,.08); border-color:rgba(239,68,68,.3); }
    .car-urg-warn .car-urg-badge      { color:#fbbf24; background:rgba(251,191,36,.08); border-color:rgba(251,191,36,.3); }
    .car-urg-ok   .car-urg-badge      { color:#34d399; background:rgba(52,211,153,.07); border-color:rgba(52,211,153,.22); }
    .car-doc-cost { font-size:.72rem; color:#64748b; }

    /* Maintenance card */
    .car-maint-card { display:flex; align-items:center; gap:12px; border-radius:14px; padding:14px; margin-bottom:8px; cursor:pointer; transition:background .15s; background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.07); }
    .car-maint-card:hover { background:rgba(52,211,153,.04); }
    .car-maint-icon { font-size:1.4rem; flex-shrink:0; }
    .car-maint-info { flex:1; min-width:0; }
    .car-maint-label { font-size:.9rem; font-weight:700; color:#e5e7eb; }
    .car-maint-sub { font-size:.78rem; color:#64748b; margin-top:2px; }
    .car-maint-right { text-align:right; }
    .car-maint-next { font-size:.72rem; font-weight:700; padding:2px 8px; border-radius:6px; }
    .car-maint-next.overdue { color:#ef4444; background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.25); }
    .car-maint-next.soon    { color:#fbbf24; background:rgba(251,191,36,.08); border:1px solid rgba(251,191,36,.25); }
    .car-maint-next.ok      { color:#34d399; background:rgba(52,211,153,.07); border:1px solid rgba(52,211,153,.2); }
    .car-maint-cost { font-size:.72rem; color:#64748b; margin-top:4px; }

    /* Fuel stats */
    .car-fuel-stats { display:flex; gap:8px; margin-bottom:14px; }
    .car-fuel-stat { flex:1; background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.07); border-radius:12px; padding:12px; text-align:center; }
    .car-fuel-stat-val { font-size:1.1rem; font-weight:800; color:#fbbf24; }
    .car-fuel-stat-label { font-size:.65rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#475569; margin-top:2px; }

    /* Fuel card */
    .car-fuel-card { display:flex; align-items:center; gap:12px; border-radius:14px; padding:14px; margin-bottom:8px; background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.07); }
    .car-fuel-icon { font-size:1.4rem; flex-shrink:0; }
    .car-fuel-info { flex:1; min-width:0; }
    .car-fuel-date { font-size:.9rem; font-weight:700; color:#e5e7eb; }
    .car-fuel-sub { font-size:.78rem; color:#64748b; margin-top:2px; }
    .car-fuel-right { text-align:right; }
    .car-fuel-liters { font-size:.95rem; font-weight:800; color:#fbbf24; }
    .car-fuel-price { font-size:.72rem; color:#64748b; margin-top:2px; }
    .car-fuel-total { font-size:.82rem; font-weight:700; color:#60a5fa; }

    /* Empty state */
    .car-empty { text-align:center; padding:40px 20px; color:#475569; }
    .car-empty-icon { font-size:2.5rem; margin-bottom:8px; }
    .car-empty-text { font-size:.88rem; }

    /* Delete btn */
    .car-del-btn { background:none; border:none; color:rgba(239,68,68,.3); cursor:pointer; font-size:.8rem; padding:4px; border-radius:6px; flex-shrink:0; }
    .car-del-btn:hover { color:#ef4444; background:rgba(239,68,68,.08); }

    /* Modal overlay */
    .car-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.7); z-index:9999; display:flex; align-items:flex-end; justify-content:center; overflow-y:auto; }
    @media (min-width:600px) { .car-modal-overlay { align-items:center; padding:16px; } }
    .car-modal { background:#0f172a; border:1px solid rgba(255,255,255,.12); border-radius:20px 20px 0 0; padding:20px 20px 32px; width:100%; max-width:560px; max-height:92vh; overflow-y:auto; position:relative; }
    @media (min-width:600px) { .car-modal { border-radius:20px; padding:24px; max-height:88vh; } }
    .car-modal-drag { width:40px; height:4px; border-radius:2px; background:rgba(255,255,255,.12); margin:0 auto 18px; }
    .car-modal-title { font-size:1rem; font-weight:800; color:#e5e7eb; margin-bottom:18px; }
    .car-modal-section { font-size:.65rem; font-weight:800; text-transform:uppercase; letter-spacing:.1em; color:#64748b; margin:14px 0 8px; }
    .car-field-row { display:flex; gap:8px; margin-bottom:10px; }
    .car-field { display:flex; flex-direction:column; gap:5px; flex:1; min-width:0; }
    .car-field label { font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; }
    .car-field input, .car-field textarea, .car-field select {
      background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.12);
      border-radius:10px; padding:11px 12px; color:#e5e7eb; font-size:16px; outline:none;
      width:100%; font-family:inherit; -webkit-appearance:none;
    }
    .car-field input:focus, .car-field textarea:focus, .car-field select:focus {
      border-color:rgba(96,165,250,.5); background:rgba(96,165,250,.04);
    }
    .car-field select option { background:#0f172a; }
    .car-pill-row { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px; }
    .car-pill-row.scroll { flex-wrap:nowrap; overflow-x:auto; -webkit-overflow-scrolling:touch; padding-bottom:4px; scrollbar-width:none; }
    .car-pill-row.scroll::-webkit-scrollbar { display:none; }
    .car-pill-opt { padding:8px 14px; border-radius:20px; border:1px solid rgba(255,255,255,.1); font-size:.82rem; cursor:pointer; color:#64748b; background:none; transition:all .15s; white-space:nowrap; flex-shrink:0; }
    .car-pill-opt.sel-pink   { background:rgba(96,165,250,.12); border-color:rgba(96,165,250,.5); color:#60a5fa; font-weight:700; }
    .car-pill-opt.sel-cyan   { background:rgba(52,211,153,.1);  border-color:rgba(52,211,153,.45);  color:#34d399; font-weight:700; }
    .car-pill-opt.sel-purple { background:rgba(167,139,250,.1); border-color:rgba(167,139,250,.45); color:#a78bfa; font-weight:700; }
    .car-pill-opt.sel-gold   { background:rgba(251,191,36,.1);  border-color:rgba(251,191,36,.45);  color:#fbbf24; font-weight:700; }
    .car-modal-btns { display:flex; gap:10px; justify-content:flex-end; margin-top:20px; }
    .car-modal-save { padding:10px 24px; border-radius:10px; border:none; background:linear-gradient(135deg,#3b82f6,#2563eb); color:#fff; font-size:.85rem; font-weight:700; cursor:pointer; }
    .car-modal-save:hover { filter:brightness(1.12); }
    .car-modal-cancel { padding:10px 18px; border-radius:10px; border:1px solid rgba(255,255,255,.12); background:none; color:#64748b; font-size:.85rem; cursor:pointer; }
    .car-modal-cancel:hover { color:#94a3b8; }
    .car-modal-delete { padding:10px 18px; border-radius:10px; border:1px solid rgba(239,68,68,.3); background:rgba(239,68,68,.06); color:#ef4444; font-size:.82rem; cursor:pointer; margin-right:auto; }
    .car-modal-delete:hover { background:rgba(239,68,68,.12); }
    .car-checkbox-row { display:flex; align-items:center; gap:8px; margin-bottom:10px; font-size:.85rem; color:#94a3b8; cursor:pointer; }
    .car-checkbox-row input { width:auto; }

    /* File attachment */
    .car-file-zone { border:1px dashed rgba(96,165,250,.3); border-radius:10px; padding:16px; text-align:center; cursor:pointer; color:#64748b; font-size:.82rem; transition:all .15s; margin-top:4px; }
    .car-file-zone:hover { border-color:rgba(96,165,250,.6); color:#94a3b8; background:rgba(96,165,250,.03); }
    .car-file-zone.has-file { border-color:rgba(52,211,153,.45); background:rgba(52,211,153,.04); color:#e5e7eb; }
    .car-file-btn { background:none; border:1px solid rgba(96,165,250,.25); border-radius:6px; color:#60a5fa; font-size:.72rem; padding:2px 7px; cursor:pointer; flex-shrink:0; }
    .car-file-btn:hover { background:rgba(96,165,250,.08); }
    .car-file-remove { color:#ef4444; cursor:pointer; margin-left:8px; font-size:.85rem; }
  `;

  /* ── State ────────────────────────────────────────────────────────── */
  var state = {
    data: emptyData(),
    selectedVehicleId: null,
    activeTab: 'docs',
    editingDoc: null,
    editingMaint: null,
    editingFuel: null,
    editingVehicle: null,
    showVehicleModal: false,
    showDocModal: false,
    showMaintModal: false,
    showFuelModal: false,
  };

  function getSelectedVehicle() {
    if (!state.selectedVehicleId && state.data.vehicles.length > 0) {
      state.selectedVehicleId = state.data.vehicles[0].id;
    }
    return state.data.vehicles.find(function(v) { return v.id === state.selectedVehicleId; }) || null;
  }
  function getDocsForVehicle() {
    var v = getSelectedVehicle(); if (!v) return [];
    return state.data.documents.filter(function(d) { return d.vehicleId === v.id; })
      .sort(function(a, b) {
        // docs with expiry sort by date (soonest first); no-expiry docs go to end
        var ae = a.expiryDate || '9999-99-99';
        var be = b.expiryDate || '9999-99-99';
        return ae.localeCompare(be);
      });
  }
  function getMaintForVehicle() {
    var v = getSelectedVehicle(); if (!v) return [];
    return state.data.maintenance.filter(function(m) { return m.vehicleId === v.id; })
      .sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
  }
  function getFuelForVehicle() {
    var v = getSelectedVehicle(); if (!v) return [];
    return state.data.fuel.filter(function(f) { return f.vehicleId === v.id; })
      .sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
  }

  function calcAvgConsumption() {
    var logs = state.data.fuel.filter(function(f) {
      return f.vehicleId === (getSelectedVehicle() || {}).id && f.fullTank && f.odometer > 0;
    }).sort(function(a,b) { return a.odometer - b.odometer; });
    if (logs.length < 2) return null;
    var totalL = 0, totalKm = 0;
    for (var i = 1; i < logs.length; i++) {
      var km = logs[i].odometer - logs[i-1].odometer;
      if (km > 0 && logs[i].liters > 0) {
        totalL  += logs[i].liters;
        totalKm += km;
      }
    }
    return totalKm > 0 ? (totalL / totalKm) * 100 : null;
  }

  /* ── Tab section ─────────────────────────────────────────────────── */
  function addTabSection() {
    if (document.getElementById(CONTAINER_ID)) return;
    var shell = document.querySelector('.shell');
    if (!shell) return;
    var sec = document.createElement('section');
    sec.id = CONTAINER_ID;
    sec.className = 'tab card';
    sec.style.display = 'none';
    shell.appendChild(sec);
  }

  function addNavButtons() {
    // Desktop sidebar
    var sidebar = document.getElementById('desktop-sidebar');
    var spacer  = sidebar && sidebar.querySelector('.sb-spacer');
    if (sidebar && spacer && !sidebar.querySelector('[data-tab="car"]')) {
      var sb = document.createElement('button');
      sb.className = 'sb-item'; sb.dataset.tab = 'car';
      sb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg><span class="sb-label">Car</span>';
      sidebar.insertBefore(sb, spacer);
    }

    // Tab bar
    var tabsBar = document.querySelector('.tabs');
    if (tabsBar && !tabsBar.querySelector('[data-tab="car"]')) {
      var tb = document.createElement('button');
      tb.className = 'tab-btn'; tb.dataset.tab = 'car'; tb.textContent = '🚗 Car';
      tabsBar.appendChild(tb);
    }

    // Mobile sheet
    var msheet = document.querySelector('.msheet-grid');
    if (msheet && !msheet.querySelector('[data-tab="car"]')) {
      var ms = document.createElement('div');
      ms.className = 'msheet-item'; ms.dataset.tab = 'car';
      ms.innerHTML = '<div class="msheet-icon">🚗</div><span>Car</span>';
      var sep = msheet.querySelector('.msheet-sep-row');
      if (sep) msheet.insertBefore(ms, sep); else msheet.appendChild(ms);
    }
  }

  function patchTabSystem() {
    var orig = window._homerShowTab;
    if (!orig || orig._hjCar) return;
    function patched(name) {
      var ct = document.getElementById(CONTAINER_ID);
      if (ct) ct.style.display = 'none';
      orig(name);
      if (name === TAB_KEY) {
        if (ct) { ct.style.display = 'block'; renderTab(); }
        document.querySelectorAll('[data-tab]').forEach(function(b) { b.classList.toggle('active', b.dataset.tab === TAB_KEY); });
        if (ct) { ct.classList.remove('tab-anim','tab-anim-right','tab-anim-left'); void ct.offsetWidth; ct.classList.add('tab-anim'); }
      }
    }
    patched._hjCar = true;
    window._homerShowTab = patched;

    if (!window._hjCarHideBound) {
      window._hjCarHideBound = true;
      window.addEventListener('homer-tab-change', function(e) {
        var name = e && e.detail && e.detail.tab;
        if (!name || name === TAB_KEY) return;
        var ct = document.getElementById(CONTAINER_ID);
        if (ct && ct.style.display !== 'none') ct.style.display = 'none';
      });
    }

    document.querySelectorAll('[data-tab="' + TAB_KEY + '"]').forEach(function(btn) {
      if (!btn._hjWired) { btn._hjWired = true; btn.addEventListener('click', function() { patched(TAB_KEY); }); }
    });
  }

  /* ── Main render ─────────────────────────────────────────────────── */
  function renderTab() {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;
    var vehicle = getSelectedVehicle();

    var html = '<div class="car-header">';
    html +=   '<div><div class="car-title-main">CAR</div><div class="car-title-sub">TRACKER</div><div class="car-title-bar"></div></div>';
    html +=   '<button class="car-add-btn" id="car-add-vehicle-btn">+ Add Vehicle</button>';
    html += '</div>';

    if (state.data.vehicles.length > 1) {
      html += '<div class="car-v-selector">';
      state.data.vehicles.forEach(function(v) {
        var active = v.id === (vehicle && vehicle.id);
        html += '<button class="car-v-pill' + (active ? ' active' : '') + '" data-vid="' + esc(v.id) + '">' + esc(v.make) + ' ' + esc(v.model) + '</button>';
      });
      html += '</div>';
    }

    if (!vehicle) {
      html += '<div class="car-empty"><div class="car-empty-icon">🚗</div><p class="car-empty-text">No vehicle added yet.<br>Track insurance, maintenance & fuel.</p></div>';
    } else {
      // Vehicle dashboard card
      html += buildVehicleCard(vehicle);

      // Tabs
      html += '<div class="car-tabs">';
      html += '<button class="car-tab-btn' + (state.activeTab === 'docs'  ? ' active' : '') + '" data-ctab="docs">Documents</button>';
      html += '<button class="car-tab-btn' + (state.activeTab === 'maint' ? ' active' : '') + '" data-ctab="maint">Maintenance</button>';
      html += '<button class="car-tab-btn' + (state.activeTab === 'fuel'  ? ' active' : '') + '" data-ctab="fuel">Fuel</button>';
      html += '</div>';

      if (state.activeTab === 'docs')  html += buildDocsTab(vehicle);
      if (state.activeTab === 'maint') html += buildMaintTab(vehicle);
      if (state.activeTab === 'fuel')  html += buildFuelTab(vehicle);
    }

    container.innerHTML = html;
    attachTabEvents(container, vehicle);
  }

  function buildVehicleCard(v) {
    var html = '<div class="car-vehicle-card">';
    html += '<div class="car-vc-top">';
    html += '<div class="car-icon-box">🚗</div>';
    html += '<div style="flex:1">';
    html += '<div class="car-vc-name">' + esc(v.make) + ' ' + esc(v.model) + '</div>';
    html += '<div class="car-vc-meta">';
    if (v.year) html += '<span style="color:#00FFFF">' + esc(String(v.year)) + '</span>';
    if (v.bodyType) html += '<span style="color:#475569">·</span><span>' + esc(v.bodyType.charAt(0).toUpperCase() + v.bodyType.slice(1)) + '</span>';
    html += '</div></div>';
    if (v.plate) html += '<div class="car-plate">' + esc(v.plate.toUpperCase()) + '</div>';
    html += '</div>';

    html += '<div class="car-vc-divider"></div>';

    // Stats grid
    var stats = [];
    if (v.odoKm)        stats.push({ icon:'📏', label:'ODOMETER',    value: Number(v.odoKm).toLocaleString('ro-RO') + ' km', color:'#00FFFF' });
    if (v.fuelType)     stats.push({ icon:'⛽', label:'FUEL',        value: v.fuelType.charAt(0).toUpperCase() + v.fuelType.slice(1), color:'#FFD700' });
    if (v.color)        stats.push({ icon:'🎨', label:'COLOR',       value: v.color.charAt(0).toUpperCase() + v.color.slice(1), color:'#CC00FF' });
    if (v.engine)       stats.push({ icon:'🔩', label:'ENGINE',      value: v.engine, color:'#FF0066' });
    if (v.powerHp)      stats.push({ icon:'⚡', label:'POWER',       value: v.powerHp + ' HP', color:'#FFD700' });
    if (v.torqueNm)     stats.push({ icon:'🌀', label:'TORQUE',      value: v.torqueNm + ' Nm', color:'#00FFFF' });
    if (v.transmission) stats.push({ icon:'⚙️', label:'GEARBOX',     value: v.transmission.toUpperCase(), color:'#00FFFF' });
    if (v.drivetrain)   stats.push({ icon:'🔧', label:'DRIVE',       value: v.drivetrain.toUpperCase(), color:'#CC00FF' });
    if (v.seats)        stats.push({ icon:'💺', label:'SEATS',       value: String(v.seats), color:'#FF0066' });
    if (v.displacement) stats.push({ icon:'🔬', label:'DISPLACEMENT',value: v.displacement, color:'#FFD700' });
    if (v.purchaseDate) stats.push({ icon:'📅', label:'PURCHASED',   value: fmtDate(v.purchaseDate), color:'#94a3b8' });
    if (v.purchasePrice) stats.push({ icon:'💶', label:'PAID',       value: fmtMoney(v.purchasePrice), color:'#00FFFF' });

    if (stats.length > 0) {
      html += '<div class="car-stats-grid">';
      stats.forEach(function(s) {
        html += '<div class="car-stat-box">';
        html += '<div class="car-stat-icon-label"><span class="car-stat-icon">' + s.icon + '</span><span class="car-stat-label" style="color:' + s.color + '80">' + s.label + '</span></div>';
        html += '<div class="car-stat-value" title="' + esc(s.value) + '">' + esc(s.value) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    if (v.vin) {
      html += '<div class="car-vin-row"><span class="car-vin-label">VIN</span><span class="car-vin-val">' + esc(v.vin.toUpperCase()) + '</span></div>';
    }

    html += '<div style="display:flex;gap:8px;margin-top:12px;">';
    html += '<button style="flex:1;padding:7px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:none;color:#94a3b8;font-size:.78rem;cursor:pointer;" id="car-edit-vehicle-btn">✏️ Edit</button>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function buildDocsTab(vehicle) {
    var docs = getDocsForVehicle();
    var html = '<div>';
    html += '<div class="car-sec-header"><span class="car-sec-title">Documents</span>';
    html += '<button class="car-add-small car-add-doc" id="car-add-doc-btn">+ Add Document</button></div>';
    if (docs.length === 0) {
      html += '<div class="car-empty"><div class="car-empty-icon">📋</div><p class="car-empty-text">No documents yet.<br>Add insurance, vignette, ITP, driver\'s license…</p></div>';
    } else {
      docs.forEach(function(doc) {
        var hasExpiry = !!doc.expiryDate;
        var days = hasExpiry ? daysUntil(doc.expiryDate) : 9999;
        var uc = hasExpiry ? urgencyClass(days) : 'car-urg-ok';
        var ul = hasExpiry ? urgencyLabel(days) : 'No expiry';
        var ti = docTypeInfo(doc.type);
        html += '<div class="car-doc-card ' + uc + '" data-doc-id="' + esc(doc.id) + '">';
        html += '<span class="car-doc-icon">' + ti.icon + '</span>';
        html += '<div class="car-doc-info">';
        html += '<div class="car-doc-label">' + esc(doc.label || ti.label) + '</div>';
        if (hasExpiry) html += '<div class="car-doc-expiry">Expires: ' + fmtDate(doc.expiryDate) + '</div>';
        if (doc.docNumber) html += '<div class="car-doc-provider" style="font-family:monospace;letter-spacing:.03em;"># ' + esc(doc.docNumber) + '</div>';
        if (doc.provider) html += '<div class="car-doc-provider">' + esc(doc.provider) + '</div>';
        html += '</div>';
        html += '<div class="car-doc-right">';
        if (hasExpiry) html += '<span class="car-urg-badge">' + ul + '</span>';
        if (doc.cost) html += '<span class="car-doc-cost">' + fmtMoney(doc.cost) + '</span>';
        html += '</div>';
        if (doc.fileData) html += '<button class="car-file-btn" data-view-doc="' + esc(doc.id) + '" title="' + esc(doc.fileName || 'View file') + '">📎</button>';
        html += '<button class="car-del-btn" data-del-doc="' + esc(doc.id) + '">🗑</button>';
        html += '</div>';
      });
    }
    html += '</div>';
    return html;
  }

  function buildMaintTab(vehicle) {
    var records = getMaintForVehicle();
    var html = '<div>';
    html += '<div class="car-sec-header"><span class="car-sec-title">Service History</span>';
    html += '<button class="car-add-small car-add-maint" id="car-add-maint-btn">+ Add Service</button></div>';
    if (records.length === 0) {
      html += '<div class="car-empty"><div class="car-empty-icon">🔧</div><p class="car-empty-text">No service records yet.</p></div>';
    } else {
      records.forEach(function(rec) {
        var mi = maintTypeInfo(rec.type);
        var nextDays = rec.nextDateDue ? daysUntil(rec.nextDateDue) : 9999;
        var kmLeft = rec.nextOdoKm && vehicle.odoKm ? rec.nextOdoKm - vehicle.odoKm : 9999;
        var nextCls = (nextDays < 0 || kmLeft < 0) ? 'overdue' : (nextDays <= 30 || kmLeft < 1000) ? 'soon' : 'ok';
        var hasNext = rec.nextDateDue || rec.nextOdoKm;
        html += '<div class="car-maint-card" data-maint-id="' + esc(rec.id) + '">';
        html += '<span class="car-maint-icon">' + mi.icon + '</span>';
        html += '<div class="car-maint-info">';
        html += '<div class="car-maint-label">' + esc(rec.label) + '</div>';
        var sub = [];
        if (rec.date) sub.push(fmtDate(rec.date));
        if (rec.odometer) sub.push(Number(rec.odometer).toLocaleString('ro-RO') + ' km');
        if (rec.workshop) sub.push(rec.workshop);
        html += '<div class="car-maint-sub">' + sub.map(esc).join(' · ') + '</div>';
        html += '</div>';
        html += '<div class="car-maint-right">';
        if (hasNext) {
          var nextLabel = '';
          if (rec.nextOdoKm && vehicle.odoKm) nextLabel = 'in ' + Number(kmLeft).toLocaleString('ro-RO') + ' km';
          else if (rec.nextOdoKm) nextLabel = 'at ' + Number(rec.nextOdoKm).toLocaleString('ro-RO') + ' km';
          else if (rec.nextDateDue) nextLabel = fmtDate(rec.nextDateDue);
          html += '<div class="car-maint-next ' + nextCls + '">Next: ' + esc(nextLabel) + '</div>';
        }
        if (rec.cost) html += '<div class="car-maint-cost">' + fmtMoney(rec.cost) + '</div>';
        html += '</div>';
        html += '<button class="car-del-btn" data-del-maint="' + esc(rec.id) + '">🗑</button>';
        html += '</div>';
      });
    }
    html += '</div>';
    return html;
  }

  function buildFuelTab(vehicle) {
    var logs = getFuelForVehicle();
    var avg = calcAvgConsumption();
    var totalSpent = logs.reduce(function(s, f) { return s + (f.totalCost || 0); }, 0);
    var html = '<div>';
    // Stats
    html += '<div class="car-fuel-stats">';
    html += '<div class="car-fuel-stat"><div class="car-fuel-stat-val">' + logs.length + '</div><div class="car-fuel-stat-label">Fills</div></div>';
    html += '<div class="car-fuel-stat"><div class="car-fuel-stat-val">' + (avg ? avg.toFixed(1) + ' L/100' : '—') + '</div><div class="car-fuel-stat-label">Avg</div></div>';
    html += '<div class="car-fuel-stat"><div class="car-fuel-stat-val" style="color:#FF0066">' + (totalSpent > 0 ? totalSpent.toLocaleString('ro-RO', {maximumFractionDigits:0}) + ' lei' : '—') + '</div><div class="car-fuel-stat-label">Total Spent</div></div>';
    html += '</div>';
    html += '<div class="car-sec-header"><span class="car-sec-title">Fuel Log</span>';
    html += '<button class="car-add-small car-add-fuel" id="car-add-fuel-btn">+ Add Fill</button></div>';
    if (logs.length === 0) {
      html += '<div class="car-empty"><div class="car-empty-icon">⛽</div><p class="car-empty-text">No fuel entries yet.</p></div>';
    } else {
      logs.forEach(function(f) {
        html += '<div class="car-fuel-card">';
        html += '<span class="car-fuel-icon">⛽</span>';
        html += '<div class="car-fuel-info">';
        html += '<div class="car-fuel-date">' + fmtDate(f.date) + (f.fullTank ? ' <span style="font-size:.65rem;color:#00FFFF;background:rgba(0,255,255,.08);border:1px solid rgba(0,255,255,.2);border-radius:4px;padding:1px 5px;">FULL</span>' : '') + '</div>';
        var sub = [];
        if (f.odometer) sub.push(Number(f.odometer).toLocaleString('ro-RO') + ' km');
        if (f.station) sub.push(f.station);
        html += '<div class="car-fuel-sub">' + sub.map(esc).join(' · ') + '</div>';
        html += '</div>';
        html += '<div class="car-fuel-right">';
        if (f.liters) html += '<div class="car-fuel-liters">' + Number(f.liters).toFixed(2) + ' L</div>';
        if (f.pricePerLiter) html += '<div class="car-fuel-price">' + Number(f.pricePerLiter).toFixed(3) + ' lei/L</div>';
        if (f.totalCost) html += '<div class="car-fuel-total">' + Number(f.totalCost).toFixed(2) + ' lei</div>';
        html += '</div>';
        html += '<button class="car-del-btn" data-del-fuel="' + esc(f.id) + '">🗑</button>';
        html += '</div>';
      });
    }
    html += '</div>';
    return html;
  }

  /* ── Event wiring ────────────────────────────────────────────────── */
  function attachTabEvents(container, vehicle) {
    // Add vehicle button
    var addVBtn = document.getElementById('car-add-vehicle-btn');
    if (addVBtn) addVBtn.onclick = function() { state.editingVehicle = null; openVehicleModal(null); };

    // Edit vehicle
    var editVBtn = document.getElementById('car-edit-vehicle-btn');
    if (editVBtn) editVBtn.onclick = function() { openVehicleModal(vehicle); };

    // Vehicle selector
    container.querySelectorAll('[data-vid]').forEach(function(btn) {
      btn.onclick = function() { state.selectedVehicleId = btn.getAttribute('data-vid'); renderTab(); };
    });

    // Tabs
    container.querySelectorAll('[data-ctab]').forEach(function(btn) {
      btn.onclick = function() { state.activeTab = btn.getAttribute('data-ctab'); renderTab(); };
    });

    // Add buttons
    var addDocBtn = document.getElementById('car-add-doc-btn');
    if (addDocBtn) addDocBtn.onclick = function() { openDocModal(null, vehicle); };
    var addMaintBtn = document.getElementById('car-add-maint-btn');
    if (addMaintBtn) addMaintBtn.onclick = function() { openMaintModal(null, vehicle); };
    var addFuelBtn = document.getElementById('car-add-fuel-btn');
    if (addFuelBtn) addFuelBtn.onclick = function() { openFuelModal(null, vehicle); };

    // Edit cards
    container.querySelectorAll('[data-doc-id]').forEach(function(card) {
      card.onclick = function(e) {
        if (e.target.closest('[data-del-doc]')) return;
        var doc = state.data.documents.find(function(d) { return d.id === card.getAttribute('data-doc-id'); });
        if (doc) openDocModal(doc, vehicle);
      };
    });
    container.querySelectorAll('[data-maint-id]').forEach(function(card) {
      card.onclick = function(e) {
        if (e.target.closest('[data-del-maint]')) return;
        var rec = state.data.maintenance.find(function(m) { return m.id === card.getAttribute('data-maint-id'); });
        if (rec) openMaintModal(rec, vehicle);
      };
    });

    // View attached file
    container.querySelectorAll('[data-view-doc]').forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        var doc = state.data.documents.find(function(d) { return d.id === btn.getAttribute('data-view-doc'); });
        if (!doc || !doc.fileData) return;
        var a = document.createElement('a');
        a.href = doc.fileData;
        a.download = doc.fileName || 'document';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
    });

    // Delete buttons
    container.querySelectorAll('[data-del-doc]').forEach(function(btn) {
      btn.onclick = function(e) { e.stopPropagation(); deleteDoc(btn.getAttribute('data-del-doc')); };
    });
    container.querySelectorAll('[data-del-maint]').forEach(function(btn) {
      btn.onclick = function(e) { e.stopPropagation(); deleteMaint(btn.getAttribute('data-del-maint')); };
    });
    container.querySelectorAll('[data-del-fuel]').forEach(function(btn) {
      btn.onclick = function(e) { e.stopPropagation(); deleteFuel(btn.getAttribute('data-del-fuel')); };
    });
  }

  /* ── CRUD ────────────────────────────────────────────────────────── */
  function deleteDoc(id) {
    state.data.documents = state.data.documents.filter(function(d) { return d.id !== id; });
    save(state.data); renderTab();
  }
  function deleteMaint(id) {
    state.data.maintenance = state.data.maintenance.filter(function(m) { return m.id !== id; });
    save(state.data); renderTab();
  }
  function deleteFuel(id) {
    state.data.fuel = state.data.fuel.filter(function(f) { return f.id !== id; });
    save(state.data); renderTab();
  }

  /* ── Vehicle modal ───────────────────────────────────────────────── */
  function openVehicleModal(existing) {
    var overlay = document.createElement('div');
    overlay.className = 'car-modal-overlay';
    var v = existing || {};
    function pill(arr, field, selClass) {
      return arr.map(function(t) {
        var val = typeof t === 'string' ? t : t;
        var sel = (v[field] || '') === val;
        return '<button type="button" class="car-pill-opt' + (sel ? ' ' + selClass : '') + '" data-val="' + esc(val) + '">' + esc(val.charAt(0).toUpperCase() + val.slice(1)) + '</button>';
      }).join('');
    }
    overlay.innerHTML = '<div class="car-modal">' +
      '<div class="car-modal-title">' + (existing ? 'Edit Vehicle' : 'Add Vehicle') + '</div>' +

      '<div class="car-modal-section" style="color:#FF006680">BASIC INFO</div>' +
      '<div class="car-field-row">' +
        '<div class="car-field"><label>Make</label><input id="cv-make" value="' + esc(v.make||'') + '" placeholder="e.g. Volkswagen"/></div>' +
        '<div class="car-field"><label>Model</label><input id="cv-model" value="' + esc(v.model||'') + '" placeholder="e.g. Golf"/></div>' +
      '</div>' +
      '<div class="car-field-row">' +
        '<div class="car-field"><label>Year</label><input id="cv-year" type="number" value="' + esc(v.year||'') + '" placeholder="2022"/></div>' +
        '<div class="car-field"><label>Plate</label><input id="cv-plate" value="' + esc(v.plate||'') + '" placeholder="B 123 ABC"/></div>' +
      '</div>' +
      '<div class="car-field-row">' +
        '<div class="car-field"><label>Color</label><input id="cv-color" value="' + esc(v.color||'') + '" placeholder="Black"/></div>' +
        '<div class="car-field"><label>Odometer (km)</label><input id="cv-odo" type="number" value="' + esc(v.odoKm||'') + '"/></div>' +
      '</div>' +
      '<div class="car-field"><label>VIN / Chassis Number</label><input id="cv-vin" value="' + esc(v.vin||'') + '" placeholder="17-character VIN"/></div>' +

      '<div class="car-modal-section" style="color:#FFD70080">FUEL TYPE</div>' +
      '<div class="car-pill-row" id="cv-fuel-pills">' + pill(FUEL_TYPES, 'fuelType', 'sel-gold') + '</div>' +

      '<div class="car-modal-section" style="color:#00FFFF80">BODY TYPE</div>' +
      '<div class="car-pill-row" id="cv-body-pills">' + pill(BODY_TYPES, 'bodyType', 'sel-cyan') + '</div>' +

      '<div class="car-modal-section" style="color:#FF006680">ENGINE</div>' +
      '<div class="car-field-row">' +
        '<div class="car-field" style="flex:1.5"><label>Engine (e.g. 2.0 TDI)</label><input id="cv-engine" value="' + esc(v.engine||'') + '" placeholder="2.0 TDI"/></div>' +
        '<div class="car-field"><label>Displacement</label><input id="cv-disp" value="' + esc(v.displacement||'') + '" placeholder="1984 cc"/></div>' +
      '</div>' +
      '<div class="car-field-row">' +
        '<div class="car-field"><label>Power (HP)</label><input id="cv-hp" type="number" value="' + esc(v.powerHp||'') + '"/></div>' +
        '<div class="car-field"><label>Torque (Nm)</label><input id="cv-nm" type="number" value="' + esc(v.torqueNm||'') + '"/></div>' +
      '</div>' +

      '<div class="car-modal-section" style="color:#CC00FF80">TRANSMISSION</div>' +
      '<div class="car-pill-row" id="cv-trans-pills">' + pill(TRANSMISSIONS, 'transmission', 'sel-purple') + '</div>' +

      '<div class="car-modal-section" style="color:#CC00FF80">DRIVETRAIN</div>' +
      '<div class="car-pill-row" id="cv-drive-pills">' + pill(DRIVETRAINS, 'drivetrain', 'sel-purple') + '</div>' +

      '<div class="car-field-row">' +
        '<div class="car-field"><label>Seats</label><input id="cv-seats" type="number" value="' + esc(v.seats||'') + '" placeholder="5"/></div>' +
        '<div class="car-field"><label>Purchase date</label><input id="cv-pdate" value="' + esc(v.purchaseDate||'') + '" placeholder="YYYY-MM-DD"/></div>' +
        '<div class="car-field"><label>Purchase price (lei)</label><input id="cv-pprice" type="number" value="' + esc(v.purchasePrice||'') + '"/></div>' +
      '</div>' +

      '<div class="car-modal-btns">' +
        (existing ? '<button class="car-modal-delete" id="cv-del-btn">Delete Vehicle</button>' : '') +
        '<button class="car-modal-cancel" id="cv-cancel-btn">Cancel</button>' +
        '<button class="car-modal-save" id="cv-save-btn">Save</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(overlay);

    // Pill toggle helpers
    var fuelType = v.fuelType || 'petrol';
    var bodyType = v.bodyType || '';
    var transmission = v.transmission || '';
    var drivetrain = v.drivetrain || '';
    function makePillToggle(containerId, getter, setter, selClass) {
      var cont = document.getElementById(containerId);
      if (!cont) return;
      cont.querySelectorAll('.car-pill-opt').forEach(function(p) {
        if (p.getAttribute('data-val') === getter()) p.classList.add(selClass);
        p.onclick = function() {
          setter(p.getAttribute('data-val'));
          cont.querySelectorAll('.car-pill-opt').forEach(function(x) { x.classList.remove(selClass); });
          p.classList.add(selClass);
        };
      });
    }
    makePillToggle('cv-fuel-pills',  function() { return fuelType; },     function(v2) { fuelType = v2; },     'sel-gold');
    makePillToggle('cv-body-pills',  function() { return bodyType; },     function(v2) { bodyType = v2; },     'sel-cyan');
    makePillToggle('cv-trans-pills', function() { return transmission; }, function(v2) { transmission = v2; }, 'sel-purple');
    makePillToggle('cv-drive-pills', function() { return drivetrain; },   function(v2) { drivetrain = v2; },   'sel-purple');

    document.getElementById('cv-cancel-btn').onclick = function() { overlay.remove(); };
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    if (existing) {
      document.getElementById('cv-del-btn').onclick = function() {
        state.data.vehicles = state.data.vehicles.filter(function(vv) { return vv.id !== existing.id; });
        state.data.documents = state.data.documents.filter(function(d) { return d.vehicleId !== existing.id; });
        state.data.maintenance = state.data.maintenance.filter(function(m) { return m.vehicleId !== existing.id; });
        state.data.fuel = state.data.fuel.filter(function(f) { return f.vehicleId !== existing.id; });
        if (state.selectedVehicleId === existing.id) state.selectedVehicleId = null;
        save(state.data); overlay.remove(); renderTab();
      };
    }
    document.getElementById('cv-save-btn').onclick = function() {
      var make = document.getElementById('cv-make').value.trim();
      var model = document.getElementById('cv-model').value.trim();
      if (!make || !model) return;
      var vObj = {
        id: (existing && existing.id) || uid(),
        make: make, model: model,
        year: parseInt(document.getElementById('cv-year').value) || 0,
        plate: document.getElementById('cv-plate').value.trim(),
        fuelType: fuelType,
        odoKm: parseInt(document.getElementById('cv-odo').value) || 0,
        color: document.getElementById('cv-color').value.trim(),
        vin: document.getElementById('cv-vin').value.trim(),
        engine: document.getElementById('cv-engine').value.trim(),
        displacement: document.getElementById('cv-disp').value.trim(),
        powerHp: parseInt(document.getElementById('cv-hp').value) || 0,
        torqueNm: parseInt(document.getElementById('cv-nm').value) || 0,
        transmission: transmission,
        drivetrain: drivetrain,
        bodyType: bodyType,
        seats: parseInt(document.getElementById('cv-seats').value) || 0,
        purchaseDate: document.getElementById('cv-pdate').value.trim(),
        purchasePrice: parseFloat(document.getElementById('cv-pprice').value) || 0,
        updatedAt: Date.now(),
      };
      if (existing) {
        state.data.vehicles = state.data.vehicles.map(function(vv) { return vv.id === existing.id ? vObj : vv; });
      } else {
        state.data.vehicles.push(vObj);
        state.selectedVehicleId = vObj.id;
      }
      save(state.data); overlay.remove(); renderTab();
    };
  }

  /* ── Document modal ──────────────────────────────────────────────── */
  function openDocModal(existing, vehicle) {
    var overlay = document.createElement('div');
    overlay.className = 'car-modal-overlay';
    var d = existing || {};
    var docType = d.type || 'insurance';

    // Determine if expiry is optional for personal docs
    var personalTypes = ['driver_license', 'id_card', 'passport'];

    overlay.innerHTML = '<div class="car-modal">' +
      '<div class="car-modal-drag"></div>' +
      '<div class="car-modal-title">' + (existing ? 'Edit Document' : '+ Add Document') + '</div>' +
      '<div class="car-modal-section" style="color:#FF006680">DOCUMENT TYPE</div>' +
      '<div class="car-pill-row scroll" id="cd-type-pills">' +
        DOC_TYPES.map(function(t) {
          return '<button type="button" class="car-pill-opt' + (docType === t.key ? ' sel-pink' : '') + '" data-val="' + t.key + '">' + t.icon + ' ' + t.label + '</button>';
        }).join('') +
      '</div>' +
      '<div class="car-field-row">' +
        '<div class="car-field"><label>Custom Label (optional)</label><input id="cd-label" value="' + esc(d.label||'') + '" placeholder="e.g. Allianz Insurance" autocomplete="off"/></div>' +
      '</div>' +
      '<div class="car-field-row">' +
        '<div class="car-field" id="cd-expiry-field"><label>Expiry Date</label><input id="cd-expiry" type="date" value="' + esc(d.expiryDate||'') + '" placeholder="' + addDays(todayStr(), 365) + '"/></div>' +
      '</div>' +
      '<div class="car-field-row">' +
        '<div class="car-field"><label>Issued by / Provider</label><input id="cd-provider" value="' + esc(d.provider||'') + '" placeholder="e.g. Allianz, MAI, Police" autocomplete="off"/></div>' +
      '</div>' +
      '<div class="car-field-row">' +
        '<div class="car-field"><label>Document Number (optional)</label><input id="cd-number" value="' + esc(d.docNumber||'') + '" placeholder="e.g. B 123456 or policy no." autocomplete="off"/></div>' +
        '<div class="car-field"><label>Cost (lei)</label><input id="cd-cost" type="number" inputmode="decimal" step="0.01" value="' + esc(d.cost||'') + '" placeholder="0.00"/></div>' +
      '</div>' +
      '<div class="car-modal-section" style="color:#00FFFF80">ATTACHED FILE</div>' +
      '<div class="car-file-zone' + (d.fileData ? ' has-file' : '') + '" id="cd-file-zone">' +
        (d.fileData ? ('📎 ' + esc(d.fileName || 'File attached') + ' <span class="car-file-remove" id="cd-file-remove">✕</span>') : '📎 Tap to attach PDF or photo · max 3 MB') +
      '</div>' +
      '<input type="file" id="cd-file-input" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" style="display:none">' +
      '<div class="car-modal-btns">' +
        (existing ? '<button class="car-modal-delete" id="cd-del-btn">Delete</button>' : '') +
        '<button class="car-modal-cancel" id="cd-cancel-btn">Cancel</button>' +
        '<button class="car-modal-save" id="cd-save-btn">Save</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(overlay);

    // ── File attachment ───────────────────────────────────────────────
    var fileData = (existing && existing.fileData) || null;
    var fileName = (existing && existing.fileName) || null;
    var fileType = (existing && existing.fileType) || null;

    function updateFileZone() {
      var zone = document.getElementById('cd-file-zone');
      if (!zone) return;
      if (fileData) {
        zone.classList.add('has-file');
        zone.innerHTML = '📎 ' + esc(fileName || 'File attached') + ' <span class="car-file-remove" id="cd-file-remove">✕</span>';
        var rem = document.getElementById('cd-file-remove');
        if (rem) rem.onclick = function(e) { e.stopPropagation(); fileData = null; fileName = null; fileType = null; updateFileZone(); };
      } else {
        zone.classList.remove('has-file');
        zone.innerHTML = '📎 Tap to attach PDF or photo · max 3 MB';
      }
    }
    // Wire existing-file remove on open
    var remBtn = document.getElementById('cd-file-remove');
    if (remBtn) remBtn.onclick = function(e) { e.stopPropagation(); fileData = null; fileName = null; fileType = null; updateFileZone(); };

    document.getElementById('cd-file-zone').onclick = function() { document.getElementById('cd-file-input').click(); };
    document.getElementById('cd-file-input').onchange = function(e) {
      var file = e.target.files[0];
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) { alert('File is too large (max 3 MB). Please compress or crop it first.'); return; }
      var reader = new FileReader();
      reader.onload = function(ev) { fileData = ev.target.result; fileName = file.name; fileType = file.type; updateFileZone(); };
      reader.readAsDataURL(file);
    };

    function updateExpiryLabel() {
      var field = document.getElementById('cd-expiry-field');
      if (!field) return;
      var lbl = field.querySelector('label');
      var isPersonal = personalTypes.indexOf(docType) >= 0;
      lbl.textContent = isPersonal ? 'Expiry Date (optional)' : 'Expiry Date';
    }
    updateExpiryLabel();

    document.getElementById('cd-type-pills').querySelectorAll('.car-pill-opt').forEach(function(p) {
      if (p.getAttribute('data-val') === docType) p.classList.add('sel-pink');
      p.onclick = function() {
        docType = p.getAttribute('data-val');
        document.getElementById('cd-type-pills').querySelectorAll('.car-pill-opt').forEach(function(x) { x.classList.remove('sel-pink'); });
        p.classList.add('sel-pink');
        var lbl = document.getElementById('cd-label');
        var ti = docTypeInfo(docType);
        // Auto-fill label if still matching a default type label or empty
        if (!lbl.value || DOC_TYPES.some(function(t) { return t.label === lbl.value; })) lbl.value = ti.label;
        updateExpiryLabel();
      };
    });
    // Auto-fill label on open
    var lblInput = document.getElementById('cd-label');
    if (!existing && !lblInput.value) lblInput.value = docTypeInfo(docType).label;

    if (existing) {
      document.getElementById('cd-del-btn').onclick = function() {
        state.data.documents = state.data.documents.filter(function(dd) { return dd.id !== existing.id; });
        save(state.data); overlay.remove(); renderTab();
      };
    }
    document.getElementById('cd-cancel-btn').onclick = function() { overlay.remove(); };
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    document.getElementById('cd-save-btn').onclick = function() {
      var expiry = document.getElementById('cd-expiry').value.trim();
      var isPersonal = personalTypes.indexOf(docType) >= 0;
      // Require expiry only for non-personal docs
      if (!expiry && !isPersonal) {
        document.getElementById('cd-expiry').focus();
        return;
      }
      var doc = {
        id: (existing && existing.id) || uid(),
        vehicleId: vehicle ? vehicle.id : '',
        type: docType,
        label: document.getElementById('cd-label').value.trim() || docTypeInfo(docType).label,
        expiryDate: expiry,
        docNumber: document.getElementById('cd-number').value.trim(),
        provider: document.getElementById('cd-provider').value.trim(),
        cost: parseFloat(document.getElementById('cd-cost').value) || 0,
        fileData: fileData,
        fileName: fileName,
        fileType: fileType,
        createdAt: (existing && existing.createdAt) || Date.now(),
        updatedAt: Date.now(),
      };
      if (existing) {
        state.data.documents = state.data.documents.map(function(dd) { return dd.id === existing.id ? doc : dd; });
      } else {
        state.data.documents.push(doc);
      }
      save(state.data); overlay.remove(); renderTab();
    };
  }

  /* ── Maintenance modal ───────────────────────────────────────────── */
  function openMaintModal(existing, vehicle) {
    var overlay = document.createElement('div');
    overlay.className = 'car-modal-overlay';
    var r = existing || {};
    var mType = r.type || 'oil';
    overlay.innerHTML = '<div class="car-modal">' +
      '<div class="car-modal-title">' + (existing ? 'Edit Record' : 'Add Service') + '</div>' +
      '<div class="car-modal-section" style="color:#00FFFF80">SERVICE TYPE</div>' +
      '<div class="car-pill-row" id="cm-type-pills">' +
        MAINT_TYPES.map(function(t) {
          return '<button type="button" class="car-pill-opt' + (mType === t.key ? ' sel-cyan' : '') + '" data-val="' + t.key + '">' + t.icon + ' ' + t.label + '</button>';
        }).join('') +
      '</div>' +
      '<div class="car-field"><label>Label</label><input id="cm-label" value="' + esc(r.label||'') + '"/></div>' +
      '<div class="car-field-row">' +
        '<div class="car-field"><label>Date done</label><input id="cm-date" value="' + esc(r.date||todayStr()) + '" placeholder="YYYY-MM-DD"/></div>' +
        '<div class="car-field"><label>Odometer (km)</label><input id="cm-odo" type="number" value="' + esc(r.odometer||'') + '"/></div>' +
      '</div>' +
      '<div class="car-field-row">' +
        '<div class="car-field"><label>Next date due</label><input id="cm-ndate" value="' + esc(r.nextDateDue||'') + '" placeholder="YYYY-MM-DD"/></div>' +
        '<div class="car-field"><label>Next km due</label><input id="cm-nkm" type="number" value="' + esc(r.nextOdoKm||'') + '"/></div>' +
      '</div>' +
      '<div class="car-field-row">' +
        '<div class="car-field"><label>Cost (lei)</label><input id="cm-cost" type="number" step="0.01" value="' + esc(r.cost||'') + '"/></div>' +
        '<div class="car-field"><label>Workshop</label><input id="cm-workshop" value="' + esc(r.workshop||'') + '"/></div>' +
      '</div>' +
      '<div class="car-modal-btns">' +
        '<button class="car-modal-cancel" id="cm-cancel-btn">Cancel</button>' +
        '<button class="car-modal-save" id="cm-save-btn" style="background:linear-gradient(135deg,#00FFFF,#0099CC);color:#0a0018;">Save</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(overlay);

    document.getElementById('cm-type-pills').querySelectorAll('.car-pill-opt').forEach(function(p) {
      if (p.getAttribute('data-val') === mType) p.classList.add('sel-cyan');
      p.onclick = function() {
        mType = p.getAttribute('data-val');
        document.getElementById('cm-type-pills').querySelectorAll('.car-pill-opt').forEach(function(x) { x.classList.remove('sel-cyan'); });
        p.classList.add('sel-cyan');
        var lbl = document.getElementById('cm-label');
        var mi = maintTypeInfo(mType);
        if (!lbl.value || MAINT_TYPES.some(function(t) { return t.label === lbl.value; })) lbl.value = mi.label;
      };
    });
    if (!existing) {
      var lblInput = document.getElementById('cm-label');
      if (!lblInput.value) lblInput.value = maintTypeInfo(mType).label;
    }

    document.getElementById('cm-cancel-btn').onclick = function() { overlay.remove(); };
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    document.getElementById('cm-save-btn').onclick = function() {
      var date = document.getElementById('cm-date').value.trim();
      if (!date) return;
      var rec = {
        id: (existing && existing.id) || uid(),
        vehicleId: vehicle.id,
        type: mType,
        label: document.getElementById('cm-label').value.trim() || maintTypeInfo(mType).label,
        date: date,
        odometer: parseInt(document.getElementById('cm-odo').value) || 0,
        nextDateDue: document.getElementById('cm-ndate').value.trim(),
        nextOdoKm: parseInt(document.getElementById('cm-nkm').value) || 0,
        cost: parseFloat(document.getElementById('cm-cost').value) || 0,
        workshop: document.getElementById('cm-workshop').value.trim(),
        createdAt: (existing && existing.createdAt) || Date.now(),
        updatedAt: Date.now(),
      };
      if (existing) {
        state.data.maintenance = state.data.maintenance.map(function(m) { return m.id === existing.id ? rec : m; });
      } else {
        state.data.maintenance.push(rec);
      }
      save(state.data); overlay.remove(); renderTab();
    };
  }

  /* ── Fuel modal ──────────────────────────────────────────────────── */
  function openFuelModal(existing, vehicle) {
    var overlay = document.createElement('div');
    overlay.className = 'car-modal-overlay';
    var f = existing || {};
    overlay.innerHTML = '<div class="car-modal">' +
      '<div class="car-modal-title">Add Fuel Entry</div>' +
      '<div class="car-field-row">' +
        '<div class="car-field"><label>Date</label><input id="cf-date" value="' + esc(f.date||todayStr()) + '"/></div>' +
        '<div class="car-field"><label>Odometer (km)</label><input id="cf-odo" type="number" value="' + esc(f.odometer||'') + '"/></div>' +
      '</div>' +
      '<div class="car-field-row">' +
        '<div class="car-field"><label>Liters</label><input id="cf-liters" type="number" step="0.01" value="' + esc(f.liters||'') + '"/></div>' +
        '<div class="car-field"><label>Price / Liter</label><input id="cf-ppl" type="number" step="0.001" value="' + esc(f.pricePerLiter||'') + '"/></div>' +
      '</div>' +
      '<div class="car-field"><label>Total cost (lei)</label><input id="cf-total" type="number" step="0.01" value="' + esc(f.totalCost||'') + '"/></div>' +
      '<div class="car-field"><label>Station</label><input id="cf-station" value="' + esc(f.station||'') + '" placeholder="Petrom, OMV…"/></div>' +
      '<label class="car-checkbox-row"><input type="checkbox" id="cf-full"' + (f.fullTank !== false ? ' checked' : '') + '> Full tank</label>' +
      '<div class="car-modal-btns">' +
        '<button class="car-modal-cancel" id="cf-cancel-btn">Cancel</button>' +
        '<button class="car-modal-save" id="cf-save-btn" style="background:linear-gradient(135deg,#FFD700,#FFA500);color:#0a0018;">Save</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(overlay);

    // Auto-calculate total
    function calcTotal() {
      var l = parseFloat(document.getElementById('cf-liters').value);
      var p = parseFloat(document.getElementById('cf-ppl').value);
      if (l > 0 && p > 0) document.getElementById('cf-total').value = (l * p).toFixed(2);
    }
    document.getElementById('cf-liters').oninput = calcTotal;
    document.getElementById('cf-ppl').oninput = calcTotal;

    document.getElementById('cf-cancel-btn').onclick = function() { overlay.remove(); };
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    document.getElementById('cf-save-btn').onclick = function() {
      var entry = {
        id: (existing && existing.id) || uid(),
        vehicleId: vehicle.id,
        date: document.getElementById('cf-date').value.trim() || todayStr(),
        odometer: parseInt(document.getElementById('cf-odo').value) || 0,
        liters: parseFloat(document.getElementById('cf-liters').value) || 0,
        pricePerLiter: parseFloat(document.getElementById('cf-ppl').value) || 0,
        totalCost: parseFloat(document.getElementById('cf-total').value) || 0,
        station: document.getElementById('cf-station').value.trim(),
        fullTank: document.getElementById('cf-full').checked,
        createdAt: (existing && existing.createdAt) || Date.now(),
      };
      if (existing) {
        state.data.fuel = state.data.fuel.map(function(ff) { return ff.id === existing.id ? entry : ff; });
      } else {
        state.data.fuel.push(entry);
      }
      save(state.data); overlay.remove(); renderTab();
    };
  }

  /* ── Bootstrap ───────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('homer-car-css')) return;
    var s = document.createElement('style');
    s.id = 'homer-car-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  ready(function () {
    injectCSS();
    addTabSection();
    addNavButtons();

    // Wire Vault dashboard tile
    var vaultTile = document.getElementById('vd-open-car');
    if (vaultTile) vaultTile.addEventListener('click', function() {
      if (typeof window._homerShowTab === 'function') window._homerShowTab(TAB_KEY);
    });

    function tryPatch() {
      if (typeof window._homerShowTab === 'function') {
        patchTabSystem();
      } else {
        setTimeout(tryPatch, 200);
      }
    }
    tryPatch();

    // Load from IDB; migrate from localStorage on first run
    loadFromIDB(function(data) {
      if (!data.vehicles.length && !data.documents.length) {
        var lsRaw = localStorage.getItem(LS_KEY);
        var lsData = safeJson(lsRaw, null);
        if (lsData && typeof lsData === 'object' && !Array.isArray(lsData)) {
          data = {
            vehicles:    lsData.vehicles    || [],
            documents:   lsData.documents   || [],
            maintenance: lsData.maintenance || [],
            fuel:        lsData.fuel        || [],
          };
          saveToIDB(data, function() {
            try { localStorage.removeItem(LS_KEY); } catch(_) {}
          });
        }
      }
      state.data = data;
      // Merge local IDB data with any CF Pages data already in localStorage (e.g. from Android's
      // last push via background poll), then push the union so neither side loses data.
      if (isBogdan() && (data.vehicles.length || data.documents.length ||
          data.maintenance.length || data.fuel.length)) {
        var _existing = safeJson(localStorage.getItem('homer-car'), null);
        var _toSync = (_existing && ((_existing.vehicles||[]).length || (_existing.documents||[]).length ||
            (_existing.maintenance||[]).length || (_existing.fuel||[]).length)) ? {
          vehicles:    mergeById(data.vehicles||[], _existing.vehicles||[]),
          documents:   mergeById(data.documents||[], _existing.documents||[]),
          maintenance: mergeById(data.maintenance||[], _existing.maintenance||[]),
          fuel:        mergeById(data.fuel||[], _existing.fuel||[]),
        } : data;
        try { localStorage.setItem('homer-car', JSON.stringify(_toSync)); } catch(_) {}
        // Push directly to Supabase in case supabase:session already fired before IDB loaded
        // (race condition: applyRemote would have seen empty state.data and pushed empty arrays).
        pushToSupabase(_toSync);
      }
      var ct = document.getElementById(CONTAINER_ID);
      if (ct && ct.style.display !== 'none') renderTab();
    });

    // Pull from Supabase when session is ready (fires after Supabase auth)
    function applyRemote(remote) {
      if (!remote) return;
      // Cloud-wins: remote is source of truth (Bogdan-only, single user).
      // Guard: only replace a category if cloud has data or local is also empty,
      // preventing accidental wipe from empty cloud response.
      var merged = {
        vehicles:    (remote.vehicles    && remote.vehicles.length)    ? remote.vehicles    : (state.data.vehicles    || []),
        documents:   (remote.documents   && remote.documents.length)   ? remote.documents   : (state.data.documents   || []),
        maintenance: (remote.maintenance && remote.maintenance.length) ? remote.maintenance : (state.data.maintenance || []),
        fuel:        (remote.fuel        && remote.fuel.length)        ? remote.fuel        : (state.data.fuel        || []),
      };
      saveToIDB(merged);
      state.data = merged;
      if (merged.vehicles.length || merged.documents.length ||
          merged.maintenance.length || merged.fuel.length) {
        pushToSupabase(merged);
      }
      var container = document.getElementById(CONTAINER_ID);
      if (container && container.style.display !== 'none') renderTab();
    }

    window.addEventListener('supabase:session', function(e) {
      if (!e.detail || !isBogdan()) return;
      // Push local IDB data now that the Supabase JS client is authenticated.
      // loadFromIDB runs before session is ready, so pushToSupabase silently no-ops there.
      // This ensures data from the main browser reaches Supabase for other browsers to pull.
      if (state.data.vehicles.length || state.data.documents.length ||
          state.data.maintenance.length || state.data.fuel.length) {
        pushToSupabase(state.data);
        // Also update localStorage so the CF Pages path has it too
        try { localStorage.setItem('homer-car', JSON.stringify(state.data)); } catch(_) {}
      }
      pullFromSupabase(applyRemote);
    });

    // Realtime: react immediately when Android pushes new car data
    window.addEventListener('supabase:field', function(e) {
      var payload = e && e.detail;
      if (!payload) return;
      var rec = payload.new || payload.old;
      if (!rec || rec.field_id !== SB_FIELD_ID) return;
      if (rec.device_id === 'web') return; // skip own writes
      applyRemote(safeJson(String(rec.value || ''), null));
    });

    // Fallback: pull after 3 s in case supabase:session already fired before this listener was registered.
    // Check isBogdan() inside the callback so it works on fresh browser (not logged in at page load).
    setTimeout(function() { if (isBogdan()) pullFromSupabase(applyRemote); }, 3000);

    // Re-pull from Supabase into IDB whenever Android pushes car data via Realtime.
    // applySyncedFieldValue writes to localStorage but the car UI reads from IDB,
    // so we need this explicit pull to bridge the gap.
    window.addEventListener('homer-data-synced', function(e) {
      if (e && e.detail && e.detail.key === 'homer-car' && isBogdan()) {
        // applySyncedFieldValue already wrote the value to localStorage — use it directly
        // so car data from Android works even without an active Supabase session.
        var lsVal = localStorage.getItem('homer-car');
        var remote = lsVal ? safeJson(lsVal, null) : null;
        if (remote && (remote.vehicles || remote.documents || remote.maintenance || remote.fuel)) {
          applyRemote(remote);
        } else {
          pullFromSupabase(applyRemote);
        }
      }
    });
  });

  function mergeById(local, remote) {
    var map = {};
    local.forEach(function(x) { map[x.id] = x; });
    remote.forEach(function(x) {
      if (!map[x.id] || (x.updatedAt || 0) > (map[x.id].updatedAt || 0)) map[x.id] = x;
    });
    return Object.values(map);
  }

})();

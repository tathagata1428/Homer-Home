/**
 * Secondbrain hub bridge.
 *
 * Mirrors the owner's data on the secondbrain sync hub (hub.b4it.ro) into
 * Homer's field_state blobs, and pushes Homer edits back. Homer joins the hub
 * as one more device (HUB_TOKEN is its device token), using the hub's own
 * push/pull API so every other secondbrain device sees Homer's changes.
 *
 *   pullHub(userId)              hub → hub_rows cache → rebuilt field_state blobs
 *   pushField(userId, id, value) Homer blob → changed hub rows (only for fields in HUB_WRITE)
 *   captureImage / setCaptureImage  a capture's picture (kept out of the inbox blob)
 *   deleteCaptures                  inbox deletes (the inbox field never deletes by omission)
 *
 * Mapping is per hub table (TABLES): toHomer(row) gives the Homer view of a
 * row, toHub(item) the hub columns Homer owns. A row is pushed only when its
 * Homer view changed, so lossy mappings (HTML ↔ text, 'urgent' → 'high')
 * never ping-pong. Hub columns Homer doesn't know are kept from the cached row.
 *
 * Hub-created items use their sync_id as Homer id; Homer-created items get a
 * new sync_id recorded in hub_links. Deletes only reach the hub for items the
 * bridge itself last delivered, and never in bulk (DELETE_GUARD).
 */
import { query } from './db.js';

const PULL_EVERY_MS = 15000;
const MAX_PULL_ROUNDS = 40;
const DELETE_GUARD = 5; // more removals than this in one save are ignored
const DELETE_MIN_AGE_MS = Number(process.env.HUB_DELETE_MIN_AGE_MS) >= 0 && process.env.HUB_DELETE_MIN_AGE_MS !== undefined
  ? Number(process.env.HUB_DELETE_MIN_AGE_MS) : 2 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function env(name) {
  return String(process.env[name] || '').trim();
}

export function isHubConfigured() {
  return !!env('HUB_TOKEN');
}

function hubUrl() {
  return (env('HUB_URL') || 'https://hub.b4it.ro').replace(/\/+$/, '');
}

function tz() {
  return env('HOMER_TZ') || 'Europe/Bucharest';
}

async function hubFetch(path, body) {
  const res = await fetch(hubUrl() + path, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: 'Bearer ' + env('HUB_TOKEN'), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (_e) { data = { error: text.slice(0, 200) }; }
  if (!res.ok) throw new Error('hub ' + path + ' HTTP ' + res.status + ': ' + (data.error || ''));
  return data;
}

// ── Conversions ───────────────────────────────────────────────

export function htmlToText(html) {
  const s = String(html || '');
  if (!/<[a-z!/]/i.test(s)) return s;
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function textToHtml(text) {
  const esc = (l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return String(text || '').split('\n').map((l) => (l ? '<p>' + esc(l) + '</p>' : '<p><br></p>')).join('');
}

const ms = (iso) => (iso ? new Date(iso).getTime() || 0 : 0);

/** 'YYYY-MM-DD' of an instant in the owner's time zone. */
export function localDate(iso) {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function tzOffsetMs(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz(), hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Local date + time in the owner's zone → epoch ms. */
export function zonedMs(date, time) {
  if (!date) return 0;
  const [h = 0, m = 0, s = 0] = String(time || '00:00:00').split(':').map(Number);
  const guess = Date.UTC(...date.split('-').map((v, i) => (i === 1 ? +v - 1 : +v)), h, m, s);
  return guess - tzOffsetMs(new Date(guess));
}

/** epoch ms → { date: 'YYYY-MM-DD', time: 'HH:MM:SS' } in the owner's zone. */
export function zonedParts(epoch) {
  const d = new Date(Number(epoch) || 0);
  const local = new Date(d.getTime() + tzOffsetMs(d)).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 19) };
}

const str = (v) => (v == null ? '' : String(v));
const norm = (v) => str(v).trim().toLowerCase().replace(/\s+/g, ' ');
const num = (v) => (v == null || v === '' ? 0 : Number(v) || 0);
const PRIORITY = (p) => {
  const v = str(p).trim().toLowerCase();
  return v === 'urgent' || v === 'critical' ? 'high' : (['high', 'medium', 'low'].includes(v) ? v : '');
};
// Parent columns the hub requires (sync-manifest `required`): a Homer child
// whose parent has no hub row (e.g. records of a vehicle that no longer
// exists) stays Homer-only instead of being rejected by the hub.
const REQUIRED_PARENT = {
  kanban_subtasks: 'card_id', goal_milestones: 'goal_id', habit_logs: 'habit_id',
  car_documents: 'vehicle_id', car_maintenance: 'vehicle_id', car_fuel: 'vehicle_id', car_odo_logs: 'vehicle_id'
};
// Car document types: secondbrain uses free labels, Homer fixed keys.
const DOC_TYPE_TO_HOMER = (t) => {
  const v = norm(t).replace(/[^a-z]/g, '');
  if (/ctp|rca/.test(v)) return 'ctp';
  if (/insur|casco/.test(v)) return 'insurance';
  if (/vignet|rovinie/.test(v)) return 'vignette';
  if (/itp|inspect/.test(v)) return 'itp';
  if (/regist|talon/.test(v)) return 'registration';
  if (/tax|impozit/.test(v)) return 'tax';
  return v || 'other';
};
const DOC_TYPE_TO_HUB = { ctp: 'CTP/RCA', insurance: 'Insurance', vignette: 'Vignette', itp: 'ITP', registration: 'Registration', tax: 'Road tax' };
const COLUMN_TO_HOMER = { todo: 'todo', in_progress: 'progress', review: 'pending', done: 'done' };
const COLUMN_TO_HUB = { todo: 'todo', backlog: 'todo', progress: 'in_progress', pending: 'review', done: 'done' };

// ── Per-table mapping ─────────────────────────────────────────
// toHomer(row, v) → Homer fields (row is a hub row; v resolves ids).
// toHub(item, v)  → hub columns Homer owns (parents given as Homer ids via v.syncOf).

const TABLES = {
  notes: {
    toHomer: (r) => ({ title: str(r.title) || 'Untitled', content: htmlToText(r.content), pinned: !!r.pinned }),
    toHub: (i) => ({ title: str(i.title), content: textToHtml(i.content), pinned: !!i.pinned })
  },
  entries: {
    toHomer: (r) => ({ date: localDate(r.date), content: htmlToText(r.content), mood: str(r.mood) }),
    toHub: (i, v, cached) => ({
      content: textToHtml(i.content),
      mood: str(i.mood) || '😊',
      // keep the hub's timestamp when the day is unchanged
      date: cached && localDate(cached.date) === i.date ? cached.date : (i.date ? i.date + 'T00:00:00.000Z' : new Date().toISOString())
    })
  },
  brain_dump: {
    toHomer: (r) => ({ content: htmlToText(r.content) }),
    toHub: (i) => ({ content: textToHtml(i.content) })
  },
  // Homer's Inbox is secondbrain's Captures. A capture's text is the item's
  // text (first line) and note (the rest). Pictures stay on the hub row and in
  // hub_rows: the inbox blob lives in localStorage, too small for them, so it
  // only says hasImage (captureImage below serves the picture). Status,
  // category and tags are set by a secondbrain desktop's AI; Homer shows them
  // and keeps them as they are.
  captures: {
    toHomer: (r) => {
      const content = str(r.content).replace(/\r\n/g, '\n').trim();
      const cut = content.indexOf('\n');
      return {
        text: cut < 0 ? content : content.slice(0, cut).trim(),
        note: cut < 0 ? '' : content.slice(cut + 1).trim(),
        source: str(r.source),
        status: str(r.status) || 'pending',
        category: str(r.category),
        tags: Array.isArray(r.tags) ? r.tags : [],
        hasImage: !!r.image_data
      };
    },
    toHub: (i, v, cached) => ({
      content: [str(i.text).trim(), str(i.note).trim()].filter(Boolean).join('\n'),
      source: cached ? str(cached.source) || 'homer' : 'homer',
      status: cached ? str(cached.status) || 'pending' : 'pending',
      tags: cached && Array.isArray(cached.tags) ? cached.tags : []
    })
  },
  saved_quotes: {
    toHomer: (r) => ({ q: str(r.text), a: str(r.author) }),
    toHub: (i) => ({ text: str(i.q), author: str(i.a) })
  },
  kanban_projects: {
    toHomer: (r) => ({ name: str(r.name) || 'Project', icon: str(r.icon) }),
    toHub: (i) => ({ name: str(i.name), icon: str(i.icon) || '📋' })
  },
  kanban_cards: {
    toHomer: (r, v) => ({
      projectId: r.project_id ? v.homerOf('kanban_projects', r.project_id) : '',
      column: COLUMN_TO_HOMER[r.column_id] || 'todo',
      summary: str(r.title),
      description: htmlToText(r.description),
      priority: PRIORITY(r.priority),
      labelsJson: JSON.stringify(Array.isArray(r.tags) ? r.tags : []),
      dueDate: str(r.due_date),
      archived: !!r.archived,
      order: num(r.position)
    }),
    toHub: (i, v, cached) => ({
      project_id: i.projectId ? v.syncOf('kanban_projects', i.projectId) : null,
      column_id: COLUMN_TO_HUB[i.column] || 'todo',
      title: str(i.summary),
      description: cached && htmlToText(cached.description) === str(i.description) ? cached.description : str(i.description),
      priority: cached && PRIORITY(cached.priority) === i.priority ? cached.priority : i.priority,
      tags: safeArr(i.labelsJson),
      due_date: i.dueDate || null,
      archived: !!i.archived,
      position: num(i.order)
    })
  },
  // Child positions use the hub's own scale; Homer only sets them for new rows.
  kanban_subtasks: {
    toHomer: (r) => ({ text: str(r.title), done: !!r.completed }),
    toHub: (i, v, cached) => ({ card_id: v.syncOf('kanban_cards', i.cardId), title: str(i.text), completed: !!i.done, position: cached ? num(cached.position) : num(i.order) })
  },
  goals: {
    toHomer: (r) => ({
      title: str(r.title), description: str(r.description), category: str(r.category),
      targetDate: str(r.target_date), status: str(r.status) || 'active', progress: num(r.progress)
    }),
    toHub: (i) => ({
      title: str(i.title), description: str(i.description), category: str(i.category),
      target_date: i.targetDate || null, status: str(i.status) || 'active', progress: num(i.progress)
    })
  },
  goal_milestones: {
    toHomer: (r) => ({ text: str(r.title), done: !!r.completed }),
    toHub: (i, v, cached) => ({ goal_id: v.syncOf('goals', i.goalId), title: str(i.text), completed: !!i.done, position: cached ? num(cached.position) : num(i.order) })
  },
  reminders: {
    toHomer: (r) => ({
      title: str(r.title), body: str(r.description),
      triggerAt: zonedMs(str(r.due_date), str(r.due_time) || '09:00:00'),
      recurType: str(r.repeat) || 'none', enabled: r.enabled !== false
    }),
    toHub: (i) => {
      const p = zonedParts(i.triggerAt);
      return { title: str(i.title), description: str(i.body), due_date: p.date, due_time: p.time, repeat: str(i.recurType) || 'none', enabled: i.enabled !== false };
    }
  },
  habits: {
    toHomer: (r) => ({ name: str(r.name), emoji: str(r.icon) || '✓' }),
    toHub: (i) => ({ name: str(i.name), icon: str(i.emoji) || '✓' })
  },
  habit_logs: {
    toHomer: (r) => ({ date: str(r.logged_date) }),
    toHub: (i, v) => ({ habit_id: v.syncOf('habits', i.habitId), logged_date: i.date })
  },
  car_vehicles: {
    toHomer: (r) => ({
      make: str(r.make), model: str(r.model), year: num(r.year), plate: str(r.plate),
      fuelType: str(r.fuel_type), color: str(r.color), vin: str(r.vin), engine: str(r.engine)
    }),
    toHub: (i) => ({
      name: [i.make, i.model].filter(Boolean).join(' '), make: str(i.make), model: str(i.model),
      year: num(i.year) || null, plate: str(i.plate), fuel_type: str(i.fuelType), color: str(i.color),
      vin: str(i.vin), engine: str(i.engine)
    })
  },
  car_documents: {
    // Devices may still hold secondbrain-style labels ("CTP/RCA"); compare as Homer keys.
    normalize: (i) => Object.assign({}, i, { type: DOC_TYPE_TO_HOMER(i.type) }),
    toHomer: (r, v) => ({
      vehicleId: v.homerOf('car_vehicles', r.vehicle_id), type: DOC_TYPE_TO_HOMER(r.type), label: str(r.name),
      expiryDate: str(r.expiry_date), provider: str(r.provider), cost: num(r.cost), fileName: str(r.file_name), fileType: str(r.file_type)
    }),
    toHub: (i, v, cached) => ({
      vehicle_id: v.syncOf('car_vehicles', i.vehicleId),
      type: cached && DOC_TYPE_TO_HOMER(cached.type) === i.type ? cached.type : (DOC_TYPE_TO_HUB[i.type] || str(i.type) || 'other'),
      name: str(i.label),
      expiry_date: i.expiryDate || null, provider: str(i.provider), cost: num(i.cost)
    })
  },
  car_maintenance: {
    toHomer: (r, v) => ({
      vehicleId: v.homerOf('car_vehicles', r.vehicle_id), type: str(r.type), label: str(r.label), date: str(r.date),
      odometer: num(r.odometer), nextDateDue: str(r.next_date), nextOdoKm: num(r.next_km), cost: num(r.cost), notes: str(r.notes)
    }),
    toHub: (i, v) => ({
      vehicle_id: v.syncOf('car_vehicles', i.vehicleId), type: str(i.type) || 'other', label: str(i.label), date: i.date || null,
      odometer: num(i.odometer) || null, next_date: i.nextDateDue || null, next_km: num(i.nextOdoKm) || null, cost: num(i.cost), notes: str(i.notes)
    })
  },
  car_fuel: {
    toHomer: (r, v) => ({
      vehicleId: v.homerOf('car_vehicles', r.vehicle_id), date: str(r.date), odometer: num(r.odometer), liters: num(r.liters),
      pricePerLiter: num(r.price_per_liter), totalCost: num(r.total_cost), station: str(r.station), fullTank: r.full_tank !== false
    }),
    toHub: (i, v) => ({
      vehicle_id: v.syncOf('car_vehicles', i.vehicleId), date: i.date || null, odometer: num(i.odometer) || null, liters: num(i.liters),
      price_per_liter: num(i.pricePerLiter), total_cost: num(i.totalCost), station: str(i.station), full_tank: i.fullTank !== false
    })
  },
  car_odo_logs: {
    toHomer: (r, v) => ({ vehicleId: v.homerOf('car_vehicles', r.vehicle_id), km: num(r.km), date: str(r.date), notes: str(r.notes) }),
    toHub: (i, v) => ({ vehicle_id: v.syncOf('car_vehicles', i.vehicleId), km: num(i.km), date: i.date || null, notes: str(i.notes) })
  },
  budget_transactions: {
    toHomer: (r) => ({ desc: str(r.description), amount: num(r.amount), cat: str(r.category), date: localDate(r.date), type: str(r.type) || 'expense' }),
    toHub: (i, v, cached) => ({
      description: str(i.desc), amount: num(i.amount), category: str(i.cat), type: i.type === 'income' ? 'income' : 'expense',
      date: cached && localDate(cached.date) === i.date ? cached.date : (i.date ? i.date + 'T12:00:00.000Z' : new Date().toISOString())
    })
  }
};

/** JSON with sorted object keys, for order-independent comparison. */
function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}

// Natural keys (on Homer-shaped items) used to recognise the same thing
// entered separately in Homer and secondbrain, so it is linked, not duplicated.
const NATURAL = {
  notes: (i) => norm(i.title) && norm(i.title) + '|' + norm(i.content).slice(0, 40),
  entries: (i) => i.date && i.date + '|' + norm(i.content).slice(0, 60),
  saved_quotes: (i) => norm(i.q),
  kanban_projects: (i) => norm(i.name),
  kanban_cards: (i) => norm(i.summary) && str(i.projectId) + '|' + norm(i.summary),
  goals: (i) => norm(i.title),
  reminders: (i) => norm(i.title),
  habits: (i) => norm(i.name),
  car_vehicles: (i) => norm(i.plate).replace(/[^a-z0-9]/g, '') || norm(i.vin),
  car_documents: (i) => i.expiryDate && str(i.vehicleId) + '|' + i.expiryDate + '|' + str(i.type),
  car_maintenance: (i) => i.date && str(i.vehicleId) + '|' + i.date,
  car_fuel: (i) => i.date && str(i.vehicleId) + '|' + i.date + '|' + num(i.liters),
  car_odo_logs: (i) => i.date && str(i.vehicleId) + '|' + i.date + '|' + num(i.km),
  budget_transactions: (i) => i.date && i.date + '|' + num(i.amount) + '|' + norm(i.desc)
};

/**
 * Link Homer items that have no hub row yet to an unlinked live hub row with
 * the same natural key. Parents are linked first so child keys (vehicleId,
 * projectId) resolve to the same Homer id on both sides.
 */
async function autoLink(userId, f, v, value) {
  const items = f.items(value, v);
  for (const tbl of f.tables) {
    const keyOf = NATURAL[tbl];
    if (!keyOf) continue;
    const linkedSyncs = new Set(items.filter((x) => x.tbl === tbl).map((x) => v.syncOf(tbl, x.id)).filter(Boolean));
    const free = new Map();
    for (const r of v.live(tbl)) {
      if (linkedSyncs.has(r.sync_id) || v.homerOf(tbl, r.sync_id) !== String(r.sync_id)) continue;
      const k = keyOf(TABLES[tbl].toHomer(r, v));
      if (k && !free.has(k)) free.set(k, r.sync_id);
    }
    for (const { tbl: t, id, item } of items) {
      if (t !== tbl || v.syncOf(tbl, id)) continue;
      const k = keyOf(item);
      const sid = k && free.get(k);
      if (!sid) continue;
      free.delete(k);
      await query('INSERT INTO hub_links (user_id, tbl, homer_id, sync_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [userId, tbl, id, sid]);
      v.link(tbl, id, sid);
    }
  }
}

function safeArr(json) {
  try { const v = typeof json === 'string' ? JSON.parse(json) : json; return Array.isArray(v) ? v : []; } catch (_e) { return []; }
}

function safeJson(text, fallback) {
  try { const v = JSON.parse(text); return v == null ? fallback : v; } catch (_e) { return fallback; }
}

// The inbox blob, also in the old { _ts, _data } wrapper an early web build wrote.
function inboxList(val) {
  let v = typeof val === 'string' ? safeJson(val, []) : val;
  if (v && !Array.isArray(v) && typeof v._ts === 'number') v = safeJson(v._data, []);
  return Array.isArray(v) ? v : [];
}

// Inbox items carry their time in whichever key the client that made them used.
function inboxTime(x) {
  return num(x.createdAt) || ms(x.ts) || ms(x.date) || (/^\d{12,}$/.test(str(x.id)) ? Number(x.id) : 0);
}

// ── Field adapters ────────────────────────────────────────────
// build(v, current) → new Homer value; items(value) → [{ tbl, id, item }] for push.
// v.live(tbl) = live hub rows; v.isDeleted(tbl, homerId); v.homerOf / v.syncOf.

/** Hub items merged over the current Homer list; Homer-only items kept, hub-deleted ones dropped. */
function mergeList(v, tbl, current, fromRow, { keepDeleted } = {}) {
  const byId = new Map((Array.isArray(current) ? current : []).filter((x) => x && x.id != null).map((x) => [String(x.id), x]));
  const out = [];
  const seen = new Set();
  for (const row of v.live(tbl)) {
    const id = v.homerOf(tbl, row.sync_id);
    seen.add(id);
    out.push(Object.assign({}, byId.get(id) || {}, fromRow(row), { id }));
  }
  for (const [id, item] of byId) {
    if (seen.has(id)) continue;
    if (v.isDeleted(tbl, id)) {
      if (typeof keepDeleted === 'function') out.push(keepDeleted(item, v.cachedRow(tbl, v.syncOf(tbl, id))));
      else if (keepDeleted) out.push(Object.assign({}, item, keepDeleted));
      continue;
    }
    out.push(item);
  }
  return out;
}

function rowFields(tbl, row, v) {
  return Object.assign(TABLES[tbl].toHomer(row, v), { updatedAt: ms(row.updated_at) });
}

const FIELDS = {
  'ls:homer-notes': {
    tables: ['notes'],
    build(v, cur) {
      const list = mergeList(v, 'notes', safeJson(cur, []), (r) => {
        const f = rowFields('notes', r, v);
        return Object.assign(f, { updated: r.updated_at });
      });
      return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    },
    items: (val) => safeJson(val, []).filter((n) => n && n.id != null).map((n) => ({ tbl: 'notes', id: String(n.id), item: n }))
  },
  'ls:homer-journal': {
    tables: ['entries'],
    build(v, cur) {
      const list = mergeList(v, 'entries', safeJson(cur, []), (r) => {
        const f = rowFields('entries', r, v);
        f.wordCount = f.content ? f.content.split(/\s+/).filter(Boolean).length : 0;
        return f;
      });
      return list.sort((a, b) => str(b.date).localeCompare(str(a.date)));
    },
    items: (val) => safeJson(val, []).filter((e) => e && e.id != null).map((e) => ({ tbl: 'entries', id: String(e.id), item: e }))
  },
  'ls:homer-brain-dump': {
    tables: ['brain_dump'],
    raw: true, // plain text value, not JSON
    build(v, cur) {
      const rows = v.live('brain_dump').sort((a, b) => ms(b.updated_at) - ms(a.updated_at));
      return rows.length ? TABLES.brain_dump.toHomer(rows[0]).content : str(cur);
    },
    items(val, v) {
      const rows = v.live('brain_dump').sort((a, b) => ms(b.updated_at) - ms(a.updated_at));
      const id = rows.length ? v.homerOf('brain_dump', rows[0].sync_id) : 'brain-dump';
      return [{ tbl: 'brain_dump', id, item: { content: str(val) } }];
    },
    noDeletes: true
  },
  'ls:savedQuotes': {
    tables: ['saved_quotes'],
    // Homer quotes have no ids: a quote is its text.
    build(v, cur) {
      const key = (q) => str(q).trim().toLowerCase();
      const out = v.live('saved_quotes').map((r) => ({ q: str(r.text), a: str(r.author), ts: ms(r.updated_at) }));
      const have = new Set(out.map((x) => key(x.q)));
      for (const q of safeJson(cur, [])) {
        const t = q && (q.q || q.text);
        if (t && !have.has(key(t)) && !v.deletedTexts.has(key(t))) out.push(q);
      }
      return out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    },
    items(val, v) {
      const byText = new Map(v.live('saved_quotes').map((r) => [str(r.text).trim().toLowerCase(), r.sync_id]));
      return safeJson(val, []).filter((q) => q && (q.q || q.text)).map((q) => {
        const text = str(q.q || q.text);
        const sid = byText.get(text.trim().toLowerCase());
        return { tbl: 'saved_quotes', id: sid ? v.homerOf('saved_quotes', sid) : 'q:' + text.trim().toLowerCase(), item: { q: text, a: str(q.a || q.author) } };
      });
    },
    noDeletes: true
  },
  'ls:homer-kanban': {
    tables: ['kanban_projects', 'kanban_cards', 'kanban_subtasks'],
    build(v, cur) {
      const curVal = safeJson(cur, {});
      const curTasks = Array.isArray(curVal.tasks) ? curVal.tasks : (Array.isArray(curVal.goals) ? curVal.goals.map(normalizeTask) : []);
      const projects = mergeList(v, 'kanban_projects', (curVal.projects || []).map(normalizeProject), (r) => {
        const f = rowFields('kanban_projects', r, v);
        f.key = f.name.slice(0, 3).toUpperCase();
        return f;
      }, { keepDeleted: { archived: true } }).map((p) => Object.assign({ description: '', color: '#3B82F6', customFieldsJson: '[]', archived: false }, p));
      const subsByCard = new Map();
      for (const s of v.live('kanban_subtasks')) {
        const card = v.homerOf('kanban_cards', s.card_id);
        if (!subsByCard.has(card)) subsByCard.set(card, []);
        subsByCard.get(card).push(Object.assign({ id: v.homerOf('kanban_subtasks', s.sync_id), order: num(s.position) }, TABLES.kanban_subtasks.toHomer(s)));
      }
      const tasks = mergeList(v, 'kanban_cards', curTasks, (r) => {
        const f = rowFields('kanban_cards', r, v);
        const subs = (subsByCard.get(v.homerOf('kanban_cards', r.sync_id)) || []).sort((a, b) => a.order - b.order);
        f.subtasksJson = JSON.stringify(subs.map(({ order, ...s }) => s));
        return f;
      }, { keepDeleted: { archived: true } }).map((t) => Object.assign({ attachmentsJson: '[]', backlog: false }, t));
      return { projects, tasks };
    },
    items(val, v) {
      const blob = safeJson(val, {});
      const tasks = Array.isArray(blob.tasks) ? blob.tasks : (Array.isArray(blob.goals) ? blob.goals.map(normalizeTask) : []);
      const out = (blob.projects || []).map(normalizeProject).filter((p) => p.id).map((p) => ({ tbl: 'kanban_projects', id: p.id, item: p }));
      for (const t of tasks) {
        if (!t || !t.id) continue;
        out.push({ tbl: 'kanban_cards', id: String(t.id), item: t });
        const cardSync = v.syncOf('kanban_cards', t.id);
        const hubSubs = cardSync ? v.live('kanban_subtasks').filter((r) => r.card_id === cardSync) : [];
        safeArr(t.subtasksJson).forEach((s, idx) => {
          if (!s) return;
          const text = str(s.text || s.title);
          const sid = s.id != null && UUID_RE.test(String(s.id)) ? String(s.id)
            : (hubSubs.find((r) => str(r.title) === text) || {}).sync_id;
          const id = sid ? v.homerOf('kanban_subtasks', sid) : String(t.id) + '/' + (s.id != null ? s.id : idx);
          out.push({ tbl: 'kanban_subtasks', id, item: { cardId: String(t.id), text, done: !!s.done, order: idx } });
        });
      }
      return out;
    },
  },
  'ls:homer-life-goals': {
    tables: ['goals', 'goal_milestones'],
    build(v, cur) {
      const ms_ = new Map();
      for (const m of v.live('goal_milestones')) {
        const g = v.homerOf('goals', m.goal_id);
        if (!ms_.has(g)) ms_.set(g, []);
        ms_.get(g).push(Object.assign({ order: num(m.position) }, TABLES.goal_milestones.toHomer(m)));
      }
      return mergeList(v, 'goals', safeJson(cur, []), (r) => {
        const f = rowFields('goals', r, v);
        const list = (ms_.get(v.homerOf('goals', r.sync_id)) || []).sort((a, b) => a.order - b.order);
        f.milestonesJson = JSON.stringify(list.map((m) => ({ text: m.text, done: m.done })));
        return f;
      }).map((g) => Object.assign({ icon: '' }, g));
    },
    items(val, v) {
      const out = [];
      for (const g of safeJson(val, [])) {
        if (!g || g.id == null) continue;
        out.push({ tbl: 'goals', id: String(g.id), item: g });
        const goalSync = v.syncOf('goals', g.id);
        const hubMs = goalSync ? v.live('goal_milestones').filter((r) => r.goal_id === goalSync) : [];
        const list = Array.isArray(g.milestones) ? g.milestones : safeArr(g.milestonesJson);
        list.forEach((m, idx) => {
          const text = typeof m === 'string' ? m : str(m && m.text);
          if (!text) return;
          const sid = (hubMs.find((r) => str(r.title) === text) || {}).sync_id;
          const id = sid ? v.homerOf('goal_milestones', sid) : String(g.id) + '#' + text;
          out.push({ tbl: 'goal_milestones', id, item: { goalId: String(g.id), text, done: !!(m && m.done), order: idx } });
        });
      }
      return out;
    }
  },
  'ls:homer-inbox': {
    tables: ['captures'],
    build(v, cur) {
      const list = mergeList(v, 'captures', inboxList(cur), (r) => {
        const f = rowFields('captures', r, v);
        const created = ms(r.created_at) || f.updatedAt;
        return Object.assign(f, { ts: new Date(created || Date.now()).toISOString(), createdAt: created });
      });
      for (const x of list) if (!x.type) x.type = 'thought';
      return list.sort((a, b) => inboxTime(b) - inboxTime(a));
    },
    items: (val) => inboxList(val).filter((x) => x && x.id != null).map((x) => ({ tbl: 'captures', id: String(x.id), item: x })),
    // A saved inbox that lacks a capture usually just hasn't received it yet
    // (captures arrive from every secondbrain device). Deletes are explicit
    // instead: deleteCaptures(), from the Inbox panel.
    noDeletes: true
  },
  'ls:homer-reminders': {
    tables: ['reminders'],
    build: (v, cur) => mergeList(v, 'reminders', safeJson(cur, []), (r) => rowFields('reminders', r, v))
      .map((r) => Object.assign({ createdAt: r.updatedAt || Date.now() }, r)),
    items: (val) => safeJson(val, []).filter((r) => r && r.id != null).map((r) => ({ tbl: 'reminders', id: String(r.id), item: r }))
  },
  'ls:homer-habits': {
    tables: ['habits', 'habit_logs'],
    build(v, cur) {
      const curVal = safeJson(cur, {});
      const habits = mergeList(v, 'habits', curVal.habits || [], (r) => {
        const f = rowFields('habits', r, v);
        delete f.updatedAt;
        return f;
      }).map((h) => Object.assign({ color: '#3b82f6', category: 'other', freq: 'daily', target: 1, note: '', archived: false, created: Date.now() }, h));
      const completions = Object.assign({}, curVal.completions || {});
      for (const l of v.live('habit_logs')) completions[v.homerOf('habits', l.habit_id) + ':' + str(l.logged_date)] = true;
      for (const id of v.deletedIds('habit_logs')) {
        const row = v.cachedRow('habit_logs', id);
        if (row) delete completions[v.homerOf('habits', row.habit_id) + ':' + str(row.logged_date)];
      }
      return { habits, completions };
    },
    items(val, v) {
      const blob = safeJson(val, {});
      const out = (blob.habits || []).filter((h) => h && h.id != null).map((h) => ({ tbl: 'habits', id: String(h.id), item: h }));
      for (const [k, done] of Object.entries(blob.completions || {})) {
        const m = /^(.+):(\d{4}-\d{2}-\d{2})$/.exec(k);
        if (!m || !done) continue;
        const existing = v.live('habit_logs').find((l) => v.homerOf('habits', l.habit_id) === m[1] && str(l.logged_date) === m[2]);
        out.push({ tbl: 'habit_logs', id: existing ? v.homerOf('habit_logs', existing.sync_id) : 'log:' + k, item: { habitId: m[1], date: m[2] } });
      }
      return out;
    }
  },
  'ls:homer-car': {
    tables: ['car_vehicles', 'car_documents', 'car_maintenance', 'car_fuel', 'car_odo_logs'],
    build(v, cur) {
      const c = safeJson(cur, {});
      // Records of a car deleted in secondbrain are not brought into Homer.
      const liveCars = new Set(v.live('car_vehicles').map((r) => r.sync_id));
      const ofLiveCar = (tbl) => ({ live: (t) => v.live(t).filter((r) => liveCars.has(r.vehicle_id)), isDeleted: (t, id) => v.isDeleted(t, id), homerOf: v.homerOf });
      const odo = new Map();
      for (const l of v.live('car_odo_logs')) {
        const id = v.homerOf('car_vehicles', l.vehicle_id);
        if (!odo.has(id) || str(l.date) > odo.get(id).date) odo.set(id, { date: str(l.date), km: num(l.km) });
      }
      return {
        vehicles: mergeList(v, 'car_vehicles', c.vehicles, (r) => {
          const f = rowFields('car_vehicles', r, v);
          const o = odo.get(v.homerOf('car_vehicles', r.sync_id));
          if (o) f.odoKm = o.km;
          return f;
        }),
        documents: mergeList(ofLiveCar(), 'car_documents', dropHubRowsOfDeadCars(v, 'car_documents', c.documents, liveCars), (r) => rowFields('car_documents', r, v), { keepDeleted: tombstone }),
        maintenance: mergeList(ofLiveCar(), 'car_maintenance', dropHubRowsOfDeadCars(v, 'car_maintenance', c.maintenance, liveCars), (r) => rowFields('car_maintenance', r, v), { keepDeleted: tombstone }),
        fuel: mergeList(ofLiveCar(), 'car_fuel', dropHubRowsOfDeadCars(v, 'car_fuel', c.fuel, liveCars), (r) => rowFields('car_fuel', r, v), { keepDeleted: tombstone }),
        odoLogs: mergeList(ofLiveCar(), 'car_odo_logs', dropHubRowsOfDeadCars(v, 'car_odo_logs', c.odoLogs, liveCars), (r) => rowFields('car_odo_logs', r, v), { keepDeleted: tombstone })
      };
    },
    items(val) {
      const c = safeJson(val, {});
      // Retired (deleted) records count as removed, never as rows to upload.
      const pick = (tbl, list) => (Array.isArray(list) ? list : []).filter((x) => x && x.id != null && !x.deleted).map((x) => ({ tbl, id: String(x.id), item: x }));
      return [
        ...pick('car_vehicles', c.vehicles), ...pick('car_documents', c.documents), ...pick('car_maintenance', c.maintenance),
        ...pick('car_fuel', c.fuel), ...pick('car_odo_logs', c.odoLogs)
      ];
    }
  },
  'ls:homer-expenses': budgetField('expense'),
  'ls:homer-income': budgetField('income')
};

/**
 * A deletion marker the car screen keeps through its union-by-id merge:
 * deleted, and newer than any copy a device still holds. Stable once applied.
 */
function tombstone(item, row) {
  if (item.deleted) return item;
  return Object.assign({}, item, { deleted: true, updatedAt: Math.max(num(item.updatedAt), ms(row && row.updated_at)) + 1 });
}

/** Items that came from hub rows of a car no longer live become deletion markers. */
function dropHubRowsOfDeadCars(v, tbl, list, liveCars) {
  return (Array.isArray(list) ? list : []).map((item) => {
    const sid = item && v.syncOf(tbl, item.id);
    const row = sid && v.cachedRow(tbl, sid);
    return row && !liveCars.has(row.vehicle_id) ? tombstone(item, row) : item;
  });
}

function budgetField(type) {
  return {
    tables: ['budget_transactions'],
    build(v, cur) {
      const mine = { live: (t) => v.live(t).filter((r) => (str(r.type) || 'expense') === type), isDeleted: v.isDeleted, homerOf: v.homerOf };
      return mergeList(mine, 'budget_transactions', safeJson(cur, []), (r) => rowFields('budget_transactions', r, v))
        .map((e) => Object.assign({ note: '' }, e))
        .sort((a, b) => str(b.date).localeCompare(str(a.date)));
    },
    items: (val) => safeJson(val, []).filter((e) => e && e.id != null)
      .map((e) => ({ tbl: 'budget_transactions', id: String(e.id), item: Object.assign({}, e, { type }) })),
    scope: (row) => (str(row.type) || 'expense') === type
  };
}

// Web vault tasks/projects → the normalized shape Android and the bridge use.
function normalizeTask(t) {
  return {
    id: String(t.id || ''), column: t.col || t.column || 'todo', summary: t.summary || '',
    description: t.notes || t.description || '', priority: t.priority || '',
    labelsJson: Array.isArray(t.labels) ? JSON.stringify(t.labels) : (t.labelsJson || '[]'),
    subtasksJson: Array.isArray(t.subtasks) ? JSON.stringify(t.subtasks) : (t.subtasksJson || '[]'),
    attachmentsJson: Array.isArray(t.attachments) ? JSON.stringify(t.attachments) : (t.attachmentsJson || '[]'),
    dueDate: t.due || t.dueDate || '', archived: !!t.archived, backlog: !!t.backlog, order: t.order || 0,
    projectId: String(t.projectId || ''), updatedAt: t.updatedAt || 0
  };
}

function normalizeProject(p) {
  return {
    id: String(p.id || ''), name: p.name || 'Project', key: p.key || (p.name || '').slice(0, 3).toUpperCase(),
    description: p.description || '', icon: p.icon || '', color: p.color || '#3B82F6',
    customFieldsJson: Array.isArray(p.customFields) ? JSON.stringify(p.customFields) : (p.customFieldsJson || '[]'),
    archived: !!p.archived, updatedAt: p.updatedAt || 0
  };
}

export const BRIDGED_FIELDS = Object.keys(FIELDS);

export function isBridgedField(fieldId) {
  return Object.prototype.hasOwnProperty.call(FIELDS, fieldId);
}

/** Fields Homer may write back to the hub (HUB_WRITE = comma list, or "all"). */
export function isWritableField(fieldId) {
  const w = env('HUB_WRITE');
  if (!w || !isBridgedField(fieldId)) return false;
  return w === 'all' || w.split(',').map((s) => s.trim()).includes(fieldId);
}

// ── View over the cache ───────────────────────────────────────

async function loadView(userId, tables) {
  const [rows, links] = await Promise.all([
    query('SELECT tbl, sync_id, data, deleted, updated_at FROM hub_rows WHERE user_id = $1 AND tbl = ANY($2) ORDER BY tbl, updated_at, sync_id', [userId, tables]),
    query('SELECT tbl, homer_id, sync_id FROM hub_links WHERE user_id = $1', [userId])
  ]);
  const byTbl = new Map();
  const cache = new Map();
  for (const r of rows) {
    cache.set(r.tbl + ':' + r.sync_id, r);
    if (!byTbl.has(r.tbl)) byTbl.set(r.tbl, []);
    byTbl.get(r.tbl).push(r);
  }
  const homerOfMap = new Map(links.map((l) => [l.tbl + ':' + l.sync_id, l.homer_id]));
  const syncOfMap = new Map(links.map((l) => [l.tbl + ':' + l.homer_id, l.sync_id]));
  const deletedTexts = new Set((byTbl.get('saved_quotes') || []).filter((r) => r.deleted).map((r) => str(r.data.text).trim().toLowerCase()));
  const v = {
    live: (tbl) => (byTbl.get(tbl) || []).filter((r) => !r.deleted).map((r) => Object.assign({}, r.data, { sync_id: r.sync_id, updated_at: r.data.updated_at || r.updated_at })),
    deletedIds: (tbl) => (byTbl.get(tbl) || []).filter((r) => r.deleted).map((r) => r.sync_id),
    cachedRow: (tbl, syncId) => { const r = cache.get(tbl + ':' + syncId); return r ? r.data : null; },
    homerOf: (tbl, syncId) => (syncId ? homerOfMap.get(tbl + ':' + syncId) || String(syncId) : ''),
    syncOf: (tbl, homerId) => {
      const id = String(homerId || '');
      if (!id) return null;
      return syncOfMap.get(tbl + ':' + id) || (UUID_RE.test(id) ? id : null);
    },
    isDeleted: (tbl, homerId) => {
      const sid = v.syncOf(tbl, homerId);
      const r = sid && cache.get(tbl + ':' + sid);
      return !!(r && r.deleted);
    },
    deletedTexts,
    cache,
    link: (tbl, homerId, syncId) => { homerOfMap.set(tbl + ':' + syncId, homerId); syncOfMap.set(tbl + ':' + homerId, syncId); }
  };
  return v;
}

// ── Pull ──────────────────────────────────────────────────────

const ALL_TABLES = [...new Set(Object.values(FIELDS).flatMap((f) => f.tables))];

/** Pull hub changes (throttled) and rebuild affected Homer fields. Never throws. */
export async function pullHub(userId, { force = false } = {}) {
  if (!isHubConfigured() || !userId) return { skipped: 'not-configured' };
  try {
    const claimed = await query(
      `INSERT INTO hub_state (user_id, last_pull) VALUES ($1, NOW())
       ON CONFLICT (user_id) DO UPDATE SET last_pull = NOW()
       WHERE $2 OR hub_state.last_pull < NOW() - make_interval(secs => $3)
       RETURNING user_id`,
      [userId, force, PULL_EVERY_MS / 1000]
    );
    if (!claimed.length) return { skipped: 'throttled' };

    const cursorRows = await query('SELECT tbl, seq FROM hub_cursors WHERE user_id = $1', [userId]);
    const cursors = Object.fromEntries(ALL_TABLES.map((t) => [t, '0']));
    for (const c of cursorRows) cursors[c.tbl] = c.seq;

    const changed = new Set();
    let pending = [...ALL_TABLES];
    for (let round = 0; round < MAX_PULL_ROUNDS && pending.length; round++) {
      const res = await hubFetch('/api/sync/pull-batch', { tables: pending.map((t) => ({ table: t, sinceSeq: cursors[t] })) });
      const results = res.results || {};
      const next = [];
      for (const t of pending) {
        const r = results[t];
        if (!r || r.error) continue;
        const rows = Array.isArray(r.rows) ? r.rows : [];
        await cacheRows(userId, t, rows.map(({ hub_seq, ...data }) => data));
        if (r.nextSeq != null && String(r.nextSeq) !== String(cursors[t])) {
          cursors[t] = String(r.nextSeq);
          await query(
            `INSERT INTO hub_cursors (user_id, tbl, seq) VALUES ($1, $2, $3) ON CONFLICT (user_id, tbl) DO UPDATE SET seq = EXCLUDED.seq`,
            [userId, t, cursors[t]]
          );
        }
        if (rows.length) { changed.add(t); next.push(t); }
      }
      pending = next;
    }

    const rebuilt = [];
    for (const [fieldId, f] of Object.entries(FIELDS)) {
      if (!force && !f.tables.some((t) => changed.has(t))) continue;
      if (await rebuildField(userId, fieldId)) rebuilt.push(fieldId);
    }
    await query('UPDATE hub_state SET last_error = NULL WHERE user_id = $1', [userId]);
    return { changedTables: [...changed], rebuilt };
  } catch (err) {
    await query('UPDATE hub_state SET last_error = $2 WHERE user_id = $1', [userId, String(err.message || err).slice(0, 500)]).catch(() => {});
    return { error: err.message || String(err) };
  }
}

function serialize(f, built) {
  return f.raw ? str(built) : JSON.stringify(built);
}

/** Upsert hub rows (as received/pushed) into the hub_rows cache in one statement. */
async function cacheRows(userId, tbl, rows) {
  if (!rows.length) return;
  await query(
    `INSERT INTO hub_rows (user_id, tbl, sync_id, data, deleted, updated_at)
     SELECT $1, $2, (x->>'sync_id')::uuid, x, (x->>'deleted_at') IS NOT NULL, COALESCE((x->>'updated_at')::timestamptz, NOW())
     FROM jsonb_array_elements($3::jsonb) x
     ON CONFLICT (user_id, tbl, sync_id) DO UPDATE SET data = EXCLUDED.data, deleted = EXCLUDED.deleted, updated_at = EXCLUDED.updated_at`,
    [userId, tbl, JSON.stringify(rows)]
  );
}

async function rebuildField(userId, fieldId) {
  const f = FIELDS[fieldId];
  const [cur] = await query('SELECT value FROM field_state WHERE user_id = $1 AND field_id = $2', [userId, fieldId]);
  const v = await loadView(userId, f.tables);
  if (cur && cur.value) await autoLink(userId, f, v, cur.value);
  const built = f.build(v, cur ? cur.value : null);
  const value = serialize(f, built);
  // Compare by content, not key order, so an unchanged hub never re-sends a field.
  if (cur && (f.raw ? cur.value === value : canonical(safeJson(cur.value, null)) === canonical(built))) return false;
  const now = Date.now();
  await query(
    `INSERT INTO field_state (user_id, field_id, kind, value, deleted, client_ts, client_seq, device_id, server_ts)
     VALUES ($1, $2, $3, $4, FALSE, $5, 0, 'hub', $5)
     ON CONFLICT (user_id, field_id) DO UPDATE SET kind = EXCLUDED.kind, value = EXCLUDED.value, deleted = FALSE,
       client_ts = EXCLUDED.client_ts, client_seq = 0, device_id = 'hub', server_ts = EXCLUDED.server_ts`,
    [userId, fieldId, f.raw ? 'text' : 'json', value, now]
  );
  return true;
}

// ── Push ──────────────────────────────────────────────────────

const PARENT_ORDER = ALL_TABLES; // FIELDS lists parents before children

/**
 * Push Homer's value of a bridged field to the hub. Never throws.
 * dryRun: plan only — returns the rows that would be pushed, sends nothing.
 */
export async function pushField(userId, fieldId, value, { dryRun = false } = {}) {
  if (!isHubConfigured() || (!dryRun && !isWritableField(fieldId)) || !isBridgedField(fieldId)) return { skipped: true };
  const f = FIELDS[fieldId];
  try {
    const v = await loadView(userId, f.tables);
    if (!dryRun) await autoLink(userId, f, v, value);
    const items = f.items(value, v);
    const nowIso = new Date().toISOString();
    const byTable = new Map();
    const present = new Map(); // tbl → Set of sync_ids still in Homer

    const ordered = items.slice().sort((a, b) => PARENT_ORDER.indexOf(a.tbl) - PARENT_ORDER.indexOf(b.tbl));
    for (const { tbl, id, item } of ordered) {
      const map = TABLES[tbl];
      let syncId = v.syncOf(tbl, id);
      const cached = syncId ? v.cachedRow(tbl, syncId) : null;
      if (!cached && REQUIRED_PARENT[tbl] && !map.toHub(item, v, null)[REQUIRED_PARENT[tbl]]) continue;
      if (!syncId) {
        syncId = crypto.randomUUID();
        if (!dryRun) await query('INSERT INTO hub_links (user_id, tbl, homer_id, sync_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [userId, tbl, id, syncId]);
        v.link(tbl, id, syncId);
      }
      if (!present.has(tbl)) present.set(tbl, new Set());
      present.get(tbl).add(syncId);

      if (cached && !(cached.deleted_at)) {
        const was = map.toHomer(cached, v);
        const now = map.normalize ? map.normalize(item) : item;
        const changed = Object.keys(was).some((k) => !sameValue(was[k], homerValue(now, k, was[k])));
        if (!changed) continue;
      }
      const hubCols = map.toHub(item, v, cached);
      const base = cached ? Object.fromEntries(Object.entries(cached).filter(([k]) => k !== 'hub_seq')) : {};
      const row = Object.assign(base, hubCols, { sync_id: syncId, updated_at: nowIso, deleted_at: null });
      if (!cached) row.created_at = nowIso;
      if (!byTable.has(tbl)) byTable.set(tbl, []);
      byTable.get(tbl).push(row);
    }

    // Deletes: rows the bridge delivers to Homer (what build() would show) that
    // Homer no longer has. Hub rows Homer never received are never deleted.
    if (!f.noDeletes) {
      const delivered = new Map();
      for (const { tbl, id } of f.items(serialize(f, f.build(v, null)), v)) {
        const sid = v.syncOf(tbl, id);
        if (!sid) continue;
        if (!delivered.has(tbl)) delivered.set(tbl, new Set());
        delivered.get(tbl).add(sid);
      }
      const deletes = [];
      let wiped = false;
      for (const tbl of f.tables) {
        const keep = present.get(tbl) || new Set();
        const shown = delivered.get(tbl) || new Set();
        if (shown.size && !keep.size) wiped = true;
        // Rows touched on the hub in the last 2 minutes may not have reached Homer yet.
        for (const r of v.live(tbl)) {
          if (shown.has(r.sync_id) && !keep.has(r.sync_id) && ms(r.updated_at) < Date.now() - DELETE_MIN_AGE_MS) deletes.push([tbl, r]);
        }
      }
      // All or nothing: a save that empties a list or removes many rows at once
      // is far more likely a bug or a stale device than a real cleanup.
      if (wiped || deletes.length > DELETE_GUARD) {
        if (deletes.length) console.warn('[hub-bridge] ' + fieldId + ': refusing to delete ' + deletes.length + ' rows' + (wiped ? ' (list emptied)' : ''));
      } else {
        for (const [tbl, r] of deletes) {
          const { sync_id, updated_at, ...rest } = r;
          if (!byTable.has(tbl)) byTable.set(tbl, []);
          byTable.get(tbl).push(Object.assign(rest, { sync_id, updated_at: nowIso, deleted_at: nowIso }));
        }
      }
    }

    if (dryRun) {
      return { planned: Object.fromEntries([...byTable].map(([t, rows]) => [t, rows.map((r) => ({ sync_id: r.sync_id, deleted: !!r.deleted_at }))])) };
    }
    const pushed = {};
    for (const tbl of PARENT_ORDER) {
      const rows = byTable.get(tbl);
      if (!rows || !rows.length) continue;
      for (let i = 0; i < rows.length; i += 20) {
        const chunk = rows.slice(i, i + 20);
        const res = await hubFetch('/api/sync/push', { table: tbl, rows: chunk });
        if (res.error) throw new Error(tbl + ': ' + res.error);
        await cacheRows(userId, tbl, chunk);
      }
      pushed[tbl] = rows.length;
    }
    return { pushed };
  } catch (err) {
    console.error('[hub-bridge] push ' + fieldId + ':', err.message || err);
    return { error: err.message || String(err) };
  }
}

/** The Homer item's value for a compared key (absent keys count as unchanged). */
function homerValue(item, key, fallback) {
  return Object.prototype.hasOwnProperty.call(item, key) ? item[key] : fallback;
}

function sameValue(a, b) {
  if (typeof a === 'number' || typeof b === 'number') return num(a) === num(b);
  if (typeof a === 'boolean' || typeof b === 'boolean') return !!a === !!b;
  return str(a).trim() === str(b).trim();
}

// ── Capture pictures ──────────────────────────────────────────

const IMAGE_COLS = ['image_name', 'image_type', 'image_data'];

/** The picture of the capture behind an inbox item, from the cache, or null. */
export async function captureImage(userId, homerId) {
  const v = await loadView(userId, ['captures']);
  const sid = v.syncOf('captures', homerId);
  const row = sid ? v.cachedRow('captures', sid) : null;
  if (!row || !row.image_data) return null;
  return { image_name: str(row.image_name), image_type: str(row.image_type) || 'image/jpeg', image_data: str(row.image_data) };
}

/**
 * Sets (or with image null, removes) the picture of an inbox item's capture.
 * The item has to have reached the hub first: { notYet: true } until it has.
 */
export async function setCaptureImage(userId, homerId, image) {
  if (!isHubConfigured()) return { error: 'not-configured' };
  const v = await loadView(userId, ['captures']);
  const sid = v.syncOf('captures', homerId);
  const cached = sid ? v.cachedRow('captures', sid) : null;
  if (!cached || cached.deleted_at) return { notYet: true };
  const row = Object.fromEntries(Object.entries(cached).filter(([k]) => k !== 'hub_seq'));
  for (const c of IMAGE_COLS) row[c] = image ? str(image[c]) || null : null;
  row.updated_at = new Date().toISOString();
  const res = await hubFetch('/api/sync/push', { table: 'captures', rows: [row] });
  if (res.error) return { error: res.error };
  await cacheRows(userId, 'captures', [row]);
  await rebuildField(userId, 'ls:homer-inbox');
  return { ok: true };
}

/** Deletes the captures behind these inbox items (ones never sent are skipped). */
export async function deleteCaptures(userId, homerIds) {
  if (!isHubConfigured()) return { error: 'not-configured' };
  const v = await loadView(userId, ['captures']);
  const nowIso = new Date().toISOString();
  const rows = [];
  for (const id of homerIds) {
    const sid = v.syncOf('captures', String(id));
    const cached = sid ? v.cachedRow('captures', sid) : null;
    if (!cached || cached.deleted_at) continue;
    const row = Object.fromEntries(Object.entries(cached).filter(([k]) => k !== 'hub_seq'));
    rows.push(Object.assign(row, { updated_at: nowIso, deleted_at: nowIso }));
  }
  for (let i = 0; i < rows.length; i += 20) {
    const chunk = rows.slice(i, i + 20);
    const res = await hubFetch('/api/sync/push', { table: 'captures', rows: chunk });
    if (res.error) return { error: res.error };
    await cacheRows(userId, 'captures', chunk);
  }
  if (rows.length) await rebuildField(userId, 'ls:homer-inbox');
  return { ok: true, deleted: rows.length };
}

/** The inbox blob as field_state holds it (after a pullHub). */
export async function inboxValue(userId) {
  const [cur] = await query('SELECT value FROM field_state WHERE user_id = $1 AND field_id = $2', [userId, 'ls:homer-inbox']);
  return cur ? cur.value : '[]';
}

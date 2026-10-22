-- ============================================================
-- Homer-Home  ·  PostgreSQL schema
-- psql "$DATABASE_URL" -f db/schema.sql   (idempotent)
--
-- No row-level security: the browser never talks to Postgres directly.
-- Every query goes through the Pages Functions, which scope rows by user_id.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid() on PG < 13

-- ── USERS ────────────────────────────────────────────────────
-- Account rows only; passwords are checked against HOMER_ADMIN_HASH.
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  email       TEXT    NOT NULL UNIQUE,
  username    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── PROFILES ─────────────────────────────────────────────────
-- One row per (user, mode).  Stores the Joey profile JSONB blob.
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mode        TEXT    NOT NULL DEFAULT 'personal' CHECK (mode IN ('personal','work')),
  data        JSONB   NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, mode)
);

-- ── MESSAGES (chat history) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  conversation_id UUID,           -- nullable; used for future grouping
  mode            TEXT    NOT NULL DEFAULT 'personal' CHECK (mode IN ('personal','work')),
  role            TEXT    NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT    NOT NULL,
  ts              BIGINT  NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_user_mode_ts   ON public.messages (user_id, mode, ts);
CREATE INDEX IF NOT EXISTS messages_conversation_ts ON public.messages (conversation_id, ts);

-- ── MEMORIES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.memories (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mode        TEXT    NOT NULL DEFAULT 'personal' CHECK (mode IN ('personal','work')),
  mem_id      TEXT,               -- original id from the old system (numeric string)
  text        TEXT    NOT NULL,
  category    TEXT    NOT NULL DEFAULT 'general',
  ts          BIGINT,
  auto        BOOLEAN DEFAULT FALSE,
  source      TEXT,
  confidence  REAL    DEFAULT 1.0,
  pinned      BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS memories_user_mode ON public.memories (user_id, mode, created_at);

-- ── TASKS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title        TEXT    NOT NULL,
  description  TEXT,
  status       TEXT    NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','in_progress','done','cancelled')),
  priority     TEXT    DEFAULT 'medium'
                 CHECK (priority IN ('low','medium','high')),
  due_at       TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata     JSONB   DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tasks_user_status ON public.tasks (user_id, status, created_at);

-- ── TASK_EVENTS (audit log) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_events (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id     UUID    NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id     UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type  TEXT    NOT NULL,
  payload     JSONB   DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── JOURNAL ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.journal (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mode        TEXT    NOT NULL DEFAULT 'personal' CHECK (mode IN ('personal','work')),
  type        TEXT    NOT NULL DEFAULT 'entry',
  role        TEXT    NOT NULL DEFAULT '',
  text        TEXT    NOT NULL DEFAULT '',
  category    TEXT    NOT NULL DEFAULT '',
  source      TEXT    NOT NULL DEFAULT 'system',
  ts          BIGINT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS journal_user_mode_ts ON public.journal (user_id, mode, ts);

-- ── DEVICES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.devices (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id    TEXT    NOT NULL,
  label        TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, device_id)
);

-- ── SYNC_CURSORS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sync_cursors (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id    TEXT    NOT NULL,
  cursor_name  TEXT    NOT NULL,   -- 'messages' | 'memories' | 'tasks'
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, device_id, cursor_name)
);

-- ── JOEY_META (JSON blobs for context_files, custom_files, file_library, sync_meta) ──
-- Used to store arbitrary Joey JSONB data that doesn't need row-level queries.
CREATE TABLE IF NOT EXISTS public.joey_meta (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mode        TEXT    NOT NULL DEFAULT 'personal' CHECK (mode IN ('personal','work')),
  key         TEXT    NOT NULL,   -- 'context_files' | 'custom_files' | 'file_library' | 'sync_meta'
  value       JSONB,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, mode, key)
);

-- ── FIELD STATE (UI field sync per user) ─────────────────────
-- Stores the latest value of every synced UI field.
-- Used by bogdan to sync fields across devices via polling.
-- Non-bogdan users stay localStorage-only (never write here).
CREATE TABLE IF NOT EXISTS public.field_state (
  id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  field_id   TEXT    NOT NULL,
  kind       TEXT    NOT NULL DEFAULT 'text',
  value      TEXT    NOT NULL DEFAULT '',
  deleted    BOOLEAN DEFAULT FALSE,
  client_ts  BIGINT  NOT NULL DEFAULT 0,
  client_seq INTEGER NOT NULL DEFAULT 0,
  device_id  TEXT    NOT NULL DEFAULT '',
  server_ts  BIGINT  NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, field_id)
);

CREATE INDEX IF NOT EXISTS field_state_user_ts ON public.field_state (user_id, server_ts);

-- ── HABITS ───────────────────────────────────────────────────
-- Habit definitions (one row per habit per user).
CREATE TABLE IF NOT EXISTS public.habits (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id   BIGINT  NOT NULL,           -- JS Date.now() id from the client
  name        TEXT    NOT NULL,
  emoji       TEXT    NOT NULL DEFAULT '⭐',
  color       TEXT    NOT NULL DEFAULT '#3b82f6',
  category    TEXT    NOT NULL DEFAULT 'other',
  freq        JSONB   NOT NULL DEFAULT '"daily"',  -- "daily" or [0,1,2,...]
  target      INTEGER NOT NULL DEFAULT 1,
  note        TEXT    NOT NULL DEFAULT '',
  archived    BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS habits_user ON public.habits (user_id, archived, display_order);

-- Habit completions (one row per habit per day).
CREATE TABLE IF NOT EXISTS public.habit_completions (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  habit_id    UUID    REFERENCES public.habits(id) ON DELETE CASCADE,
  client_habit_id BIGINT NOT NULL,        -- mirrors habits.client_id for offline use
  date        DATE    NOT NULL,
  count       INTEGER NOT NULL DEFAULT 1,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, client_habit_id, date)
);

CREATE INDEX IF NOT EXISTS habit_completions_user_date ON public.habit_completions (user_id, date);

-- ── FOCUS_SESSIONS (Pomodoro log) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID    REFERENCES public.users(id) ON DELETE CASCADE,
  task_label    TEXT,
  duration_secs INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS focus_sessions_user_created ON public.focus_sessions (user_id, created_at);

-- ── POLLING SUPPORT ──────────────────────────────────────────
-- Clients poll /api/db (op "changes") for rows whose updated_at is newer
-- than their cursor, so updated_at must move on every write.
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['profiles','memories','tasks','joey_meta','field_state','habits'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', tbl || '_touch', tbl);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', tbl || '_touch', tbl);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS field_state_user_updated ON public.field_state (user_id, updated_at);
CREATE INDEX IF NOT EXISTS messages_user_created    ON public.messages (user_id, created_at);
CREATE INDEX IF NOT EXISTS memories_user_updated    ON public.memories (user_id, updated_at);
CREATE INDEX IF NOT EXISTS tasks_user_updated       ON public.tasks (user_id, updated_at);

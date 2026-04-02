-- ============================================================
-- Homer-Home  ·  Supabase Schema
-- Run this once in the Supabase SQL Editor after creating the project.
-- ============================================================

-- ── PROFILES ─────────────────────────────────────────────────
-- One row per (user, mode).  Stores the Joey profile JSONB blob.
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode        TEXT    NOT NULL DEFAULT 'personal' CHECK (mode IN ('personal','work')),
  data        JSONB   NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, mode)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (user_id = auth.uid());

-- ── MESSAGES (chat history) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID,           -- nullable; used for future grouping
  mode            TEXT    NOT NULL DEFAULT 'personal' CHECK (mode IN ('personal','work')),
  role            TEXT    NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT    NOT NULL,
  ts              BIGINT  NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_user_mode_ts   ON public.messages (user_id, mode, ts);
CREATE INDEX IF NOT EXISTS messages_conversation_ts ON public.messages (conversation_id, ts);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "messages_update" ON public.messages FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "messages_delete" ON public.messages FOR DELETE USING (user_id = auth.uid());

-- ── MEMORIES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.memories (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memories_select" ON public.memories FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "memories_insert" ON public.memories FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "memories_update" ON public.memories FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "memories_delete" ON public.memories FOR DELETE USING (user_id = auth.uid());

-- ── TASKS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE USING (user_id = auth.uid());

-- ── TASK_EVENTS (audit log) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_events (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id     UUID    NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT    NOT NULL,
  payload     JSONB   DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.task_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_events_select" ON public.task_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "task_events_insert" ON public.task_events FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── JOURNAL ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.journal (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

ALTER TABLE public.journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_select" ON public.journal FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "journal_insert" ON public.journal FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "journal_delete" ON public.journal FOR DELETE USING (user_id = auth.uid());

-- ── DEVICES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.devices (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id    TEXT    NOT NULL,
  label        TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, device_id)
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "devices_select" ON public.devices FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "devices_insert" ON public.devices FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "devices_update" ON public.devices FOR UPDATE USING (user_id = auth.uid());

-- ── SYNC_CURSORS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sync_cursors (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id    TEXT    NOT NULL,
  cursor_name  TEXT    NOT NULL,   -- 'messages' | 'memories' | 'tasks'
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, device_id, cursor_name)
);

ALTER TABLE public.sync_cursors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_cursors_select" ON public.sync_cursors FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "sync_cursors_insert" ON public.sync_cursors FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "sync_cursors_update" ON public.sync_cursors FOR UPDATE USING (user_id = auth.uid());

-- ── JOEY_META (JSON blobs for context_files, custom_files, file_library, sync_meta) ──
-- Used to store arbitrary Joey JSONB data that doesn't need row-level queries.
CREATE TABLE IF NOT EXISTS public.joey_meta (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode        TEXT    NOT NULL DEFAULT 'personal' CHECK (mode IN ('personal','work')),
  key         TEXT    NOT NULL,   -- 'context_files' | 'custom_files' | 'file_library' | 'sync_meta'
  value       JSONB,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, mode, key)
);

ALTER TABLE public.joey_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "joey_meta_select" ON public.joey_meta FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "joey_meta_insert" ON public.joey_meta FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "joey_meta_update" ON public.joey_meta FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "joey_meta_delete" ON public.joey_meta FOR DELETE USING (user_id = auth.uid());

-- ── REALTIME ─────────────────────────────────────────────────
-- Enable realtime replication for the tables clients will subscribe to.
-- (Run this only once; idempotent via IF NOT EXISTS on table membership.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'memories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.memories;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

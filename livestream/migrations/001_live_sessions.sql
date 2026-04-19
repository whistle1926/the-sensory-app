-- ============================================================
-- Live Sessions & Recordings — core tables
-- ============================================================

-- A scheduled live session room (broadcast or interactive)
CREATE TABLE public.live_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  mode text NOT NULL DEFAULT 'broadcast',
  status text NOT NULL DEFAULT 'scheduled',
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  -- optional FK; drop or change target if consumer doesn't have a `coaches` table
  coach_id uuid,
  -- optional FK; drop or change target if consumer doesn't have a `schools` table
  school_id uuid,
  -- optional FK; drop or change target if consumer doesn't have an `event_schedule` table
  event_schedule_id uuid,
  livekit_room_name text UNIQUE NOT NULL,
  max_participants integer DEFAULT 100,
  require_auth boolean DEFAULT false,
  viewer_count_peak integer DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),

  CONSTRAINT live_rooms_mode_check CHECK (mode IN ('broadcast', 'interactive')),
  CONSTRAINT live_rooms_status_check CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled'))
);

-- Recorded session files
CREATE TABLE public.live_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_room_id uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  livekit_egress_id text,
  status text NOT NULL DEFAULT 'recording',
  storage_url text,
  storage_key text,
  duration_seconds integer,
  file_size_bytes bigint,
  thumbnail_url text,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT live_recordings_status_check CHECK (status IN ('recording', 'processing', 'ready', 'failed'))
);

-- Indexes
CREATE INDEX idx_live_rooms_coach ON public.live_rooms(coach_id);
CREATE INDEX idx_live_rooms_school ON public.live_rooms(school_id);
CREATE INDEX idx_live_rooms_status ON public.live_rooms(status);
CREATE INDEX idx_live_rooms_scheduled_start ON public.live_rooms(scheduled_start);
CREATE INDEX idx_live_rooms_event_schedule ON public.live_rooms(event_schedule_id);
CREATE INDEX idx_live_recordings_room ON public.live_recordings(live_room_id);
CREATE INDEX idx_live_recordings_status ON public.live_recordings(status);

-- RLS — permissive default: every authenticated user can read/write.
-- Tighten these policies to match your app's authorization model.
ALTER TABLE public.live_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_full" ON public.live_rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full" ON public.live_recordings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Once consumer has their own coaches/schools/event_schedule tables they
-- can add FKs like so:
--   ALTER TABLE public.live_rooms
--     ADD CONSTRAINT live_rooms_coach_id_fkey
--     FOREIGN KEY (coach_id) REFERENCES public.coaches(id) ON DELETE SET NULL;

-- Live Sessions — attachable pre-recorded media
--
-- Lets a host attach a pre-recorded video to a live_room. During the
-- stream, the host studio can "Play Media", which loads the URL into
-- a local <video> element and publishes the captured stream as a
-- LiveKit track so every viewer sees the playback over the normal
-- broadcast pipeline.
--
-- The URL can be anything — a public MP4 link the host pasted, or
-- an uploaded file in the new `live-media` Storage bucket.

-- 1. Column ------------------------------------------------------------
ALTER TABLE public.live_rooms
  ADD COLUMN IF NOT EXISTS media_url text DEFAULT '';

COMMENT ON COLUMN public.live_rooms.media_url IS
  'Optional MP4/WebM URL the host can play back through the livestream.';

-- 2. Storage bucket ----------------------------------------------------
-- Public read so viewers can also fetch directly if we ever switch from
-- captureStream to client-side playback sync. 200MB cap keeps free-tier
-- usage predictable; allowed MIME types block images/docs sneaking in.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'live-media',
  'live-media',
  true,
  209715200, -- 200 MB
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Storage RLS -------------------------------------------------------
-- Authenticated users can upload/update/delete; anyone can read (public
-- bucket means GETs are served directly via the public URL).
DROP POLICY IF EXISTS "live-media authenticated write" ON storage.objects;
CREATE POLICY "live-media authenticated write"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'live-media')
  WITH CHECK (bucket_id = 'live-media');

DROP POLICY IF EXISTS "live-media public read" ON storage.objects;
CREATE POLICY "live-media public read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'live-media');

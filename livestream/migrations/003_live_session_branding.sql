-- Live Sessions — per-session branding
--
-- Not every live session shares the same brand. Admins can override the
-- page title and add a logo URL per session; the viewer page uses these
-- in place of the default header branding.

ALTER TABLE public.live_rooms
  ADD COLUMN IF NOT EXISTS branding_title text DEFAULT '',
  ADD COLUMN IF NOT EXISTS branding_logo_url text DEFAULT '';

COMMENT ON COLUMN public.live_rooms.branding_title IS
  'Optional custom page title shown to viewers (falls back to the default header title).';

COMMENT ON COLUMN public.live_rooms.branding_logo_url IS
  'Optional http(s) logo URL shown next to the title on the viewer page.';

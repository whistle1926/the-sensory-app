# Live Stream Feature Package

Portable, self-contained live streaming feature — broadcast or interactive video
rooms with live chat, reactions, pinned links, stage invites, recording, and
per-session branding. Built on [LiveKit](https://livekit.io/).

Designed to drop into an existing **Next.js App Router** project that uses
**Supabase** for auth + storage and **shadcn/ui** for components.

---

## Quick start

1. `cp -r live-stream/examples/* <your-project>/lib/` (rename per file — see [examples/](#examples)).
2. `cp -r live-stream/migrations/* <your-project>/supabase/migrations/` and apply.
3. `cp -r live-stream/api/livekit <your-project>/app/api/livekit`.
4. `cp -r live-stream/pages/admin/* <your-project>/app/(admin)/live-sessions/` (and the host/viewer pages — see section 4).
5. `cp live-stream/.env.example <your-project>/.env.local` and fill in real values.
6. Merge `live-stream/package-deps.json` into your `package.json`, then `npm install`.

---

## 1. Overview

Three surfaces, one LiveKit room model:

| Surface              | Who uses it                       | What it does                                                             |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| Admin dashboard      | Platform admins                   | Create/start/end sessions, manage recordings, configure LiveKit          |
| Host studio          | Whoever is hosting the stream     | Publishes camera/mic/screen, controls chat, pins links, invites on stage |
| Public viewer        | Anyone with a share link          | Watches the stream, sends chat, reacts, joins on stage when invited      |

Features:

- **Two modes per session**: `broadcast` (viewers are watch-only) or `interactive` (viewers can publish cam/mic).
- **Recording** via LiveKit Cloud Egress → S3-compatible bucket (Supabase Storage works).
- **Live chat** over LiveKit data channels (no database needed — ephemeral).
- **Floating reactions** (thumbs up, heart, etc.) broadcast to all viewers.
- **Pinned links** — host can pin a URL that renders as a big call-to-action bar over the video.
- **Stage invites** — in broadcast mode, host can flip a viewer's `canPublish` permission to pull them on camera.
- **Pre-recorded media** — host can paste/upload an MP4/WebM and play it back through the stream using `captureStream()`.
- **Per-session branding** — override the page title and logo per room (for guest speakers, partners, etc.).

---

## 2. Architecture

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Admin dashboard │      │   Host studio    │      │  Public viewer   │
│  /live-sessions  │      │  /host/live/:id  │      │    /live/:id     │
└────────┬─────────┘      └────────┬─────────┘      └────────┬─────────┘
         │                         │                         │
         │       ┌─────────────────┴──────────────┐          │
         │       │   LiveKit WebRTC cloud/server  │          │
         │       └────────────┬───────────────────┘          │
         │                    │                              │
         │   ┌────────────────┼──────────────────────────────┘
         ▼   ▼                ▼
    ┌──────────────────────────────────┐
    │  Next.js API routes              │
    │   /api/livekit/token             │  (issue JWT tokens)
    │   /api/livekit/room              │  (create/start/end DB + LK)
    │   /api/livekit/recording         │  (start/stop egress)
    │   /api/livekit/participant       │  (mute/kick/stage)
    │   /api/livekit/webhook           │  (egress completion events)
    └────────────────┬─────────────────┘
                     ▼
       ┌─────────────────────────────┐
       │  Supabase Postgres          │
       │   live_rooms, live_recordings, settings   │
       └─────────────────────────────┘
```

Data flow during a live session:

1. Admin creates a `live_rooms` row + a LiveKit room name.
2. Host opens the studio; `POST /api/livekit/token` returns a JWT with `canPublish: true`.
3. Viewers open `/live/:id`; token endpoint returns `canPublish: false` (broadcast) or `true` (interactive).
4. Chat, reactions, pins, and stage state travel over LiveKit **data channels** — not the DB.
5. Recording (if started) pushes an MP4 to your S3 bucket; LiveKit webhook finalises the `live_recordings` row with size + duration.

---

## 3. Dependencies

The exact list of npm packages this package needs is in
[`package-deps.json`](./package-deps.json) at the root — it's machine-readable
so you can merge it into your own `package.json` directly. Quick install:

```bash
npm install \
  livekit-client \
  @livekit/components-react \
  @livekit/components-styles \
  @livekit/components-core \
  livekit-server-sdk \
  @livekit/protocol
```

You'll already have these peers (they're standard in a Next.js + Supabase + shadcn project):

- `next` (App Router)
- `react`, `react-dom`
- `@supabase/supabase-js`, `@supabase/ssr`
- `lucide-react` (icons)
- `sonner` (toast notifications)

---

## 4. Setup steps

1. **Install npm deps** (see above).

2. **Run migrations** in order against your Supabase project:

   ```
   migrations/001_live_sessions.sql        # live_rooms + live_recordings tables
   migrations/002_live_session_media.sql   # media_url column + live-media storage bucket
   migrations/003_live_session_branding.sql # branding_title + branding_logo_url columns
   ```

   The migrations assume you already have a `public.settings` table keyed by `key: text` with a `value: jsonb` column — this is where LiveKit credentials are stored. If you don't have one, create a minimal version:

   ```sql
   CREATE TABLE IF NOT EXISTS public.settings (
     key text PRIMARY KEY,
     value jsonb
   );
   ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "auth_full" ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
   ```

3. **Create a LiveKit project.** Sign up at [livekit.io](https://livekit.io/) (or self-host). Grab the API key, secret, and WS URL.

4. **Copy `lib/livekit-settings.ts`** into your project's `lib/` folder (imports `@/lib/supabase`).

5. **Merge `lib/types.ts`** into your own `lib/database.types.ts`. The pages import `LiveRoom`, `LiveRoomMode`, `LiveRoomStatus`, `LiveRecording`, `LiveRecordingStatus` from `@/lib/database.types`.

6. **Copy the API routes** into `app/api/livekit/` in your project. The routes assume:

   - `@/lib/auth-server` exports a `requireAdmin()` function that returns `{ ok: true } | { ok: false, error, status }`. This gates admin-only actions (create/start/end room, recording, participant mgmt). Implement it against your auth system.
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` env vars are set.

7. **Copy the pages.** Suggested routes (rename to match your layout):

   | Package path                         | Suggested route                          |
   | ------------------------------------ | ---------------------------------------- |
   | `pages/admin/sessions-list.tsx`      | `app/(admin)/live-sessions/page.tsx`     |
   | `pages/admin/session-detail.tsx`     | `app/(admin)/live-sessions/[id]/page.tsx`|
   | `pages/admin/recordings.tsx`         | `app/(admin)/recordings/page.tsx`        |
   | `pages/admin/settings.tsx`           | `app/(admin)/settings/live-sessions/page.tsx` |
   | `pages/host/sessions-list.tsx`       | `app/host/live/page.tsx`                 |
   | `pages/host/studio.tsx`              | `app/host/live/[roomId]/page.tsx`        |
   | `pages/viewer/layout.tsx`            | `app/live/layout.tsx`                    |
   | `pages/viewer/page.tsx`              | `app/live/[roomId]/page.tsx`             |

   If you use a different route for the host studio, update `HOST_STUDIO_PATH` in `pages/admin/session-detail.tsx` and `pages/host/sessions-list.tsx`.

8. **Configure LiveKit in the settings page** — mount `pages/admin/settings.tsx`, log in as an admin, and enter your API key, secret, and WS URL. These get saved to the `settings` table (key = `livekit_config`). Env vars (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL`) are used as fallback.

9. **Configure recording storage** via env vars. See [`.env.example`](./.env.example) at
   the package root for the full list (LiveKit + Supabase + S3). The recording route
   reads `RECORDING_S3_*`:

   ```
   RECORDING_S3_ACCESS_KEY=...        # Supabase Storage S3 access key (or AWS/R2/etc.)
   RECORDING_S3_SECRET_KEY=...
   RECORDING_S3_ENDPOINT=https://<your-project>.supabase.co/storage/v1/s3
   RECORDING_S3_REGION=eu-west-3      # the region string must match what the bucket provider expects
   RECORDING_S3_BUCKET=recordings
   RECORDING_S3_FORCE_PATH_STYLE=true # true for Supabase Storage and MinIO
   ```

   If you're using Supabase Storage, create the `recordings` bucket first and make it public (or give the LiveKit egress service its own access credentials).

10. **Point LiveKit at your webhook.** In the LiveKit dashboard (or `livekit.yaml`), set the webhook URL to `https://<your-domain>/api/livekit/webhook`. This is how recordings get finalised with size/duration/storage URL.

---

## 5. Required project components (shadcn/ui)

The pages import these from `@/components/ui/*`. Install them via `npx shadcn add <name>` if you don't have them:

- `button`
- `input`
- `textarea`
- `label`
- `card`
- `badge`
- `table`
- **Custom component:** `datetime-picker` — used by the admin create form. The source project has a `DateTimePicker` that takes `{ value: string; onChange: (v: string) => void; placeholder?: string }`. Swap for your own datetime input if you don't have one.

Also needed:

- `@/lib/utils` — standard shadcn `cn()` helper.

---

<a id="examples"></a>
## 6. Required external modules

The pages import a few things the consumer must provide. Ready-to-use stubs for
all of these live in [`examples/`](./examples) — copy them in and adapt to your
schema:

| Import                           | What the consumer needs                                                                                                       | Stub                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `@/lib/supabase`                 | A client-side Supabase browser client (`createBrowserClient` from `@supabase/ssr` or similar).                                | `examples/supabase-client.ts`         |
| `@/lib/auth-server`              | Server-side `requireAdmin()` guard. Minimal shape: `async function requireAdmin(): Promise<{ok: true} \| {ok: false; error: string; status: number}>`. Used by `/api/livekit/{room,recording,participant}`. | `examples/auth-server.ts`             |
| `@/components/auth-provider`     | Client-side `useAuth()` hook. Minimal shape: `useAuth(): { profile: { id: string; name: string; role: string } \| null; loading: boolean; isAdmin: boolean }`.                                                                                                                                | `examples/auth-provider.tsx`          |
| `@/lib/database.types`           | Union with the types in `live-stream/lib/types.ts`.                                                                           | (see `lib/types.ts`)                  |
| `@/lib/utils`                    | shadcn `cn()` utility.                                                                                                        | provided by shadcn                    |
| `sonner`                         | Toast provider — mount `<Toaster />` in your root layout.                                                                     | npm package                           |
| `/api/upload`                    | The admin create form expects a generic file upload endpoint that takes `FormData { file, bucket, folder }` and returns `{ url }`. | `examples/upload-route.ts`            |
| `@/components/ui/datetime-picker`| A `DateTimePicker` component with `{ value, onChange, placeholder }` props.                                                   | `examples/datetime-picker.tsx`        |

---

## 7. Database tables

### `live_rooms`

| Column                | Type         | Notes                                                                 |
| --------------------- | ------------ | --------------------------------------------------------------------- |
| `id`                  | uuid         | PK                                                                    |
| `title`               | text         | Displayed to host & viewers                                           |
| `description`         | text         | Optional                                                              |
| `mode`                | text         | `broadcast` or `interactive`                                          |
| `status`              | text         | `scheduled` / `live` / `ended` / `cancelled`                          |
| `scheduled_start`     | timestamptz  | When the session is planned                                           |
| `scheduled_end`       | timestamptz  | Optional                                                              |
| `actual_start`        | timestamptz  | Set when admin clicks "Go Live"                                       |
| `actual_end`          | timestamptz  | Set when admin clicks "End Session"                                   |
| `coach_id`            | uuid         | Optional FK — points at whoever is hosting (rename in your app)       |
| `school_id`           | uuid         | Optional FK — target audience/group (rename or drop)                  |
| `event_schedule_id`   | uuid         | Optional FK — link to a calendar event (drop if unused)               |
| `livekit_room_name`   | text UNIQUE  | Auto-generated slug used as the LiveKit room name                     |
| `max_participants`    | int          | Default 100                                                           |
| `require_auth`        | bool         | (Reserved — not enforced in current code; token route honours it.)    |
| `viewer_count_peak`   | int          | Populated by analytics if you wire it up                              |
| `notes`               | text         | Internal                                                              |
| `media_url`           | text         | Optional MP4/WebM the host can play back through the stream           |
| `branding_title`      | text         | Overrides default page title                                          |
| `branding_logo_url`   | text         | Overrides default logo                                                |

### `live_recordings`

| Column               | Type        | Notes                                                                         |
| -------------------- | ----------- | ----------------------------------------------------------------------------- |
| `id`                 | uuid        | PK                                                                            |
| `live_room_id`       | uuid        | FK → `live_rooms.id` (cascade delete)                                         |
| `livekit_egress_id`  | text        | Set when egress starts; used by webhook to correlate                          |
| `status`             | text        | `recording` / `processing` / `ready` / `failed`                               |
| `storage_url`        | text        | Final S3 URL of the MP4                                                       |
| `storage_key`        | text        | Filename in the bucket                                                        |
| `duration_seconds`   | int         | Set by webhook from LiveKit nanoseconds                                       |
| `file_size_bytes`    | bigint      | Set by webhook                                                                |
| `thumbnail_url`      | text        | Reserved — not generated by default                                           |
| `started_at`         | timestamptz | Defaults to now()                                                             |
| `ended_at`           | timestamptz | Set by webhook                                                                |

---

## 8. Known tweaks & gotchas

- **Route names.** The source project uses `/coach/live/*` for the host studio. This package renames it to `/host/live/*` throughout. If you choose a different route, search for `HOST_STUDIO_PATH` and `/host/live` in the pages and update.
- **Role gating.** The host sessions list shows every scheduled/live session by default. To filter to "only sessions hosted by the current user," set the `HOST_ID_FIELD` constant at the top of `pages/host/sessions-list.tsx` to a field on your `AuthProfile` (e.g. `"coach_id"` or `"host_id"`); the query then matches `live_rooms.coach_id = profile[HOST_ID_FIELD]`. Add the field to `AuthProfile` in your auth provider too.
- **`coach_id` / `school_id` / `event_schedule_id` columns.** These columns exist on `live_rooms` but are unused by default — the admin form does not populate them and the list/detail pages don't display them. They're left in place so you can wire them up to your own host/group/event entities if you want. To do that: add your own dropdowns to the create form (see the comment at the top of `pages/admin/sessions-list.tsx`), include them in the POST body, and either join on them in the list query or display the IDs as-is. The original migration in `migrations/001_live_sessions.sql` has commented-out FK constraints you can enable once your tables exist.
- **Upload endpoint.** The logo/media upload flow posts to `/api/upload`. A minimal implementation is in [`examples/upload-route.ts`](./examples/upload-route.ts) — copy it to `app/api/upload/route.ts`, or replace the upload buttons with direct `supabase.storage.from(bucket).upload(...)` calls.
- **`require_auth`.** The DB column exists but the token route doesn't currently reject anonymous viewers. If you want gated viewing, add that check in `/api/livekit/token/route.ts` after looking up the room.
- **Webhook security.** The webhook route verifies the LiveKit signature using the same API secret. Make sure the secret in your `settings.livekit_config` row or env var matches the one configured on LiveKit's side.
- **Chat history isn't persisted.** Chat, reactions, pins, and stage state all ride the LiveKit data channel. Late joiners don't see previous messages. The host *does* re-broadcast the current pin and stage set on each new join so those stick. If you need persistent chat, write incoming `chat` messages to a table in the viewer/host panels' data handlers.
- **Hardcoded S3 creds removed.** The original recording route had embedded Supabase S3 credentials. This package reads them from env vars (`RECORDING_S3_*`) — you must set these in production.
- **Admin auth.** `requireAdmin()` is called at the top of the room/recording/participant routes. If that returns non-ok, the request is rejected. Don't skip this — the participant route can mute and kick people.

---

## 9. File reference

```
live-stream/
├── README.md
├── .env.example                # required env vars (Supabase, LiveKit, S3 recording)
├── package-deps.json           # machine-readable npm deps to merge into your package.json
├── migrations/
│   ├── 001_live_sessions.sql
│   ├── 002_live_session_media.sql
│   └── 003_live_session_branding.sql
├── lib/
│   ├── livekit-settings.ts     # client-side LiveKit config loader
│   └── types.ts                # LiveRoom / LiveRecording interfaces to merge into database.types.ts
├── examples/                   # ready-to-use stubs for the modules the pages import
│   ├── auth-server.ts          # → @/lib/auth-server (requireAdmin guard)
│   ├── auth-provider.tsx       # → @/components/auth-provider (useAuth hook)
│   ├── supabase-client.ts      # → @/lib/supabase (browser client)
│   ├── upload-route.ts         # → app/api/upload/route.ts
│   └── datetime-picker.tsx     # → @/components/ui/datetime-picker
├── api/livekit/
│   ├── token/route.ts          # issues LiveKit JWTs
│   ├── room/route.ts           # create / start / end a room
│   ├── recording/route.ts      # start / stop egress
│   ├── webhook/route.ts        # egress completion callback
│   └── participant/route.ts    # list / mute / kick / stage-invite
└── pages/
    ├── admin/
    │   ├── sessions-list.tsx   # list + create form
    │   ├── session-detail.tsx  # details + start/end/record controls
    │   ├── recordings.tsx      # all recordings across all sessions
    │   └── settings.tsx        # LiveKit credentials form
    ├── host/
    │   ├── sessions-list.tsx   # host's own upcoming/live sessions
    │   └── studio.tsx          # full broadcast studio UI
    └── viewer/
        ├── layout.tsx
        └── page.tsx            # public viewer (broadcast or interactive)
```

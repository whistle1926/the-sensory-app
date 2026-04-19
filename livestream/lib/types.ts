// ========================
// Live Sessions & Recordings
// ========================
// Merge these interfaces into your own `lib/database.types.ts`.
// Remove the Coach / School joined relations if your schema doesn't
// have those tables.

export type LiveRoomMode = "broadcast" | "interactive";
export type LiveRoomStatus = "scheduled" | "live" | "ended" | "cancelled";
export type LiveRecordingStatus =
  | "recording"
  | "processing"
  | "ready"
  | "failed";

export interface LiveRoom {
  id: string;
  title: string;
  description: string;
  mode: LiveRoomMode;
  status: LiveRoomStatus;
  scheduled_start: string;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  coach_id: string | null;
  school_id: string | null;
  event_schedule_id: string | null;
  livekit_room_name: string;
  max_participants: number;
  require_auth: boolean;
  viewer_count_peak: number;
  notes: string;
  media_url: string;
  branding_title: string;
  branding_logo_url: string;
  created_at: string;
  // Joined relations — optional, only present when the caller joins them in.
  // Replace Coach / School with your app's own types, or delete these lines.
  // coach?: Coach;
  // school?: School;
}

export interface LiveRecording {
  id: string;
  live_room_id: string;
  livekit_egress_id: string | null;
  status: LiveRecordingStatus;
  storage_url: string | null;
  storage_key: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  thumbnail_url: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  // Joined relation — optional
  live_room?: LiveRoom;
}

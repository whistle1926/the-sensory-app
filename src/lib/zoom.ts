/**
 * Zoom integration — cloud recordings.
 *
 * Auth is a **Server-to-Server OAuth** app (account credentials grant), so
 * there's no per-user sign-in: one set of account credentials in the env and
 * the app can read the account's cloud recordings.
 *
 * We never download recordings ourselves — see src/lib/vimeo.ts. We only need
 * Zoom to tell us a recording exists and hand us a URL Vimeo can fetch.
 *
 * Env:
 *   ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET  — S2S OAuth app
 *   ZOOM_WEBHOOK_SECRET_TOKEN                            — webhook verification
 */
import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_URL = "https://zoom.us/oauth/token";
const API = "https://api.zoom.us/v2";

export function zoomConfigured(): boolean {
  return Boolean(
    process.env.ZOOM_ACCOUNT_ID &&
      process.env.ZOOM_CLIENT_ID &&
      process.env.ZOOM_CLIENT_SECRET,
  );
}

// Access tokens last ~1 hour. Cache in module scope so a burst of calls in
// one warm lambda doesn't re-mint a token each time.
let cachedToken: { token: string; expiresAt: number } | null = null;

/** Mint (or reuse) a Server-to-Server OAuth access token. */
export async function getZoomAccessToken(): Promise<string | null> {
  if (!zoomConfigured()) return null;
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;
  try {
    const basic = Buffer.from(
      `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`,
    ).toString("base64");
    const res = await fetch(
      `${TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(
        process.env.ZOOM_ACCOUNT_ID ?? "",
      )}`,
      { method: "POST", headers: { Authorization: `Basic ${basic}` } },
    );
    const json = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!res.ok || !json.access_token) {
      console.error("[zoom] token failed", res.status, json.error);
      return null;
    }
    cachedToken = {
      token: json.access_token,
      // Refresh a minute early to avoid edge-of-expiry failures.
      expiresAt: Date.now() + ((json.expires_in ?? 3600) - 60) * 1000,
    };
    return cachedToken.token;
  } catch (err) {
    console.error("[zoom] token threw", err);
    return null;
  }
}

// ── Webhook verification ──────────────────────────────────────────────
// Zoom signs each request: signature = "v0=" + HMAC_SHA256(secret,
// `v0:${timestamp}:${rawBody}`). Compare in constant time.

function webhookSecret(): string {
  return process.env.ZOOM_WEBHOOK_SECRET_TOKEN ?? "";
}

export function verifyZoomSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
): boolean {
  const secret = webhookSecret();
  if (!secret || !signature || !timestamp) return false;
  const expected =
    "v0=" +
    createHmac("sha256", secret)
      .update(`v0:${timestamp}:${rawBody}`)
      .digest("hex");
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Zoom validates a webhook endpoint by POSTing an `endpoint.url_validation`
 * event containing a plainToken; we must echo it back with its HMAC.
 */
export function urlValidationResponse(plainToken: string) {
  return {
    plainToken,
    encryptedToken: createHmac("sha256", webhookSecret())
      .update(plainToken)
      .digest("hex"),
  };
}

// ── Recording helpers ─────────────────────────────────────────────────

export interface ZoomRecordingFile {
  id?: string;
  file_type?: string;
  file_size?: number;
  recording_type?: string;
  download_url?: string;
  status?: string;
}

export interface ZoomRecordingMeeting {
  uuid: string;
  id?: number | string;
  topic?: string;
  start_time?: string;
  duration?: number;
  total_size?: number;
  recording_files?: ZoomRecordingFile[];
}

/**
 * Pick the best single video file from a Zoom recording. Zoom produces
 * several (speaker view, gallery view, shared screen, audio-only, chat).
 * We want ONE mp4 — prefer the combined screen+speaker view (what people
 * expect to watch), else the largest mp4.
 */
export function pickBestRecordingFile(
  files: ZoomRecordingFile[] | undefined,
): ZoomRecordingFile | null {
  const mp4s = (files ?? []).filter(
    (f) => (f.file_type ?? "").toUpperCase() === "MP4" && f.download_url,
  );
  if (mp4s.length === 0) return null;
  const preferred = ["shared_screen_with_speaker_view", "speaker_view", "active_speaker"];
  for (const type of preferred) {
    const hit = mp4s.find((f) => f.recording_type === type);
    if (hit) return hit;
  }
  return mp4s.reduce((a, b) => ((b.file_size ?? 0) > (a.file_size ?? 0) ? b : a));
}

/**
 * Build a URL Vimeo can fetch the file from. Zoom download URLs need a token;
 * the webhook payload supplies a short-lived `download_token`, otherwise we
 * fall back to an account access token.
 */
export function buildDownloadUrl(downloadUrl: string, token: string): string {
  const sep = downloadUrl.includes("?") ? "&" : "?";
  return `${downloadUrl}${sep}access_token=${encodeURIComponent(token)}`;
}

/**
 * Fetch ONE meeting's cloud recording by UUID — used by the Retry action, so
 * a failed sync can be re-attempted even if the meeting is older than the
 * backfill window.
 *
 * Zoom quirk: a meeting UUID that starts with "/" or contains "//" must be
 * DOUBLE url-encoded, otherwise the path is misread and you get a 404.
 */
export async function getMeetingRecording(
  uuid: string,
): Promise<ZoomRecordingMeeting | null> {
  const token = await getZoomAccessToken();
  if (!token) return null;
  const needsDoubleEncode = uuid.startsWith("/") || uuid.includes("//");
  const encoded = needsDoubleEncode
    ? encodeURIComponent(encodeURIComponent(uuid))
    : encodeURIComponent(uuid);
  try {
    const res = await fetch(`${API}/meetings/${encoded}/recordings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json().catch(() => ({}))) as
      | ZoomRecordingMeeting
      | { message?: string };
    if (!res.ok) {
      console.error(
        "[zoom] get meeting recording failed",
        res.status,
        (json as { message?: string }).message,
      );
      return null;
    }
    return json as ZoomRecordingMeeting;
  } catch (err) {
    console.error("[zoom] get meeting recording threw", err);
    return null;
  }
}

/** List the account's recent cloud recordings (used for manual backfill). */
export async function listRecentRecordings(
  fromDaysAgo = 60,
): Promise<ZoomRecordingMeeting[]> {
  const token = await getZoomAccessToken();
  if (!token) return [];
  const from = new Date(Date.now() - fromDaysAgo * 86_400_000)
    .toISOString()
    .slice(0, 10);
  try {
    const res = await fetch(
      `${API}/users/me/recordings?from=${from}&page_size=100`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const json = (await res.json().catch(() => ({}))) as {
      meetings?: ZoomRecordingMeeting[];
      message?: string;
    };
    if (!res.ok) {
      console.error("[zoom] list recordings failed", res.status, json.message);
      return [];
    }
    return json.meetings ?? [];
  } catch (err) {
    console.error("[zoom] list recordings threw", err);
    return [];
  }
}

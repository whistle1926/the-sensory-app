/**
 * Google Calendar WRITE sync (per-user OAuth).
 *
 * This is the two-way half of the calendar integration. The read-only
 * side (src/app/api/team-calendar) pulls each staff member's iCal feed to
 * DISPLAY their Google events on the portal calendar. This module does the
 * opposite: it PUSHES portal bookings into a staff member's Google diary.
 *
 * Design notes:
 *  - Raw fetch against Google's OAuth + Calendar v3 REST endpoints — no SDK
 *    dependency (keeps the serverless bundle small).
 *  - Least-privilege scope: `calendar.events` (create/edit/delete events we
 *    make) plus `openid email` so we can record which Google account granted
 *    access. We never request full calendar read.
 *  - We store only the long-lived REFRESH token (per user). Access tokens are
 *    minted on demand and never persisted.
 *  - Every network call is best-effort from the caller's perspective: these
 *    helpers return null/false on any failure and never throw, so a Google
 *    outage can't break booking creation or cancellation.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { londonDateKey } from "./date-key";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars";

/** Scope: create/manage our own events, plus identify the account. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
].join(" ");

/** True when the OAuth client credentials are configured in the env. */
export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// ── OAuth `state` CSRF token ──────────────────────────────────────────
// Signs the initiating user's id + a short expiry with AUTH_SECRET so the
// callback can trust which user is connecting and reject forged/stale
// round-trips. Mirrors the HMAC pattern in src/lib/private-pin.ts.
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes to complete consent

function stateSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set for Google OAuth state signing");
    }
    return "dev-secret-do-not-use-in-prod";
  }
  return s;
}

export function signOAuthState(userId: string): string {
  const payload = `${userId}.${Date.now() + STATE_TTL_MS}`;
  const sig = createHmac("sha256", stateSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/** Returns the userId if the state is valid + unexpired, else null. */
export function verifyOAuthState(state: string | null | undefined): string | null {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const expected = createHmac("sha256", stateSecret())
    .update(`${userId}.${exp}`)
    .digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const expiresAt = Number(exp);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
  return userId;
}

/**
 * The OAuth redirect URI. MUST exactly match one registered on the Google
 * Cloud OAuth client. We anchor it to the canonical app URL (AUTH_URL =
 * portal.thesensorysubmarine.com) rather than the request host, so the same
 * single redirect URI works no matter which alias the staff member browsed
 * in on. Falls back to the passed origin only if AUTH_URL isn't set.
 */
export function googleRedirectUri(fallbackOrigin?: string): string {
  const base =
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    fallbackOrigin ||
    "";
  // Trim surrounding whitespace, quotes and any trailing newline before
  // building the URI. Env values pasted into a dashboard often arrive with a
  // stray newline or wrapping quotes, and Google rejects the whole consent
  // request with redirect_uri_mismatch if even one character is off — a
  // miserable thing to debug, so normalise it here.
  const clean = base
    .trim()
    .replace(/\\n$/, "")
    .replace(/^["']|["']$/g, "")
    .trim()
    .replace(/\/$/, "");
  return `${clean}/api/google/callback`;
}

/** Build the Google consent URL. `state` is our signed CSRF/user token. */
export function buildConsentUrl(state: string, fallbackOrigin?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(fallbackOrigin),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    // offline + consent guarantees Google returns a refresh_token (it only
    // sends one on the first consent unless prompt=consent forces it again).
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

/** Decode a JWT payload (no signature check — token came straight from
 *  Google over TLS) to read the account email. Returns null on any issue. */
function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const obj = JSON.parse(json) as { email?: string };
    return obj.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Exchange an authorization code for tokens. Returns the refresh token and
 * the account email on success, or null on any failure.
 */
export async function exchangeCodeForTokens(
  code: string,
  fallbackOrigin?: string,
): Promise<{ refreshToken: string; email: string | null } | null> {
  if (!googleOAuthConfigured()) return null;
  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: googleRedirectUri(fallbackOrigin),
        grant_type: "authorization_code",
      }),
    });
    const json = (await res.json().catch(() => ({}))) as TokenResponse;
    if (!res.ok || !json.refresh_token) {
      console.error("[google] token exchange failed", res.status, json.error, json.error_description);
      return null;
    }
    return {
      refreshToken: json.refresh_token,
      email: emailFromIdToken(json.id_token),
    };
  } catch (err) {
    console.error("[google] token exchange threw", err);
    return null;
  }
}

/** Mint a short-lived access token from a stored refresh token. */
async function getAccessToken(refreshToken: string): Promise<string | null> {
  if (!googleOAuthConfigured()) return null;
  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
      }),
    });
    const json = (await res.json().catch(() => ({}))) as TokenResponse;
    if (!res.ok || !json.access_token) {
      console.error("[google] refresh failed", res.status, json.error, json.error_description);
      return null;
    }
    return json.access_token;
  } catch (err) {
    console.error("[google] refresh threw", err);
    return null;
  }
}

/** Revoke a refresh token at Google (best-effort, used on disconnect). */
export async function revokeToken(refreshToken: string): Promise<void> {
  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken }),
    });
  } catch {
    /* best-effort */
  }
}

/** Add HH:MM + minutes, clamped to the same day (23:59 max). */
function addMinutesToClock(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const total = Math.min(h * 60 + m + mins, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
}

export interface BookingEventInput {
  refreshToken: string;
  calendarId?: string | null;
  /** Event title, e.g. "OT Assessment — Coalisland (Jamie Smith)". */
  summary: string;
  description?: string;
  location?: string;
  /** The booking's stored date (London-midnight instant). */
  date: Date;
  /** Local wall-clock start, "HH:MM". */
  time: string;
  durationMinutes: number;
}

/**
 * Create a calendar event for a booking on the owner's connected calendar.
 * Times are sent as local wall-clock + `timeZone: Europe/London`, so Google
 * applies the zone and we do no UTC maths (correct across BST/GMT).
 * Returns the created event id, or null on any failure.
 */
export async function insertBookingEvent(
  input: BookingEventInput,
): Promise<string | null> {
  const accessToken = await getAccessToken(input.refreshToken);
  if (!accessToken) return null;

  const day = londonDateKey(input.date); // "YYYY-MM-DD" as seen in London
  const endTime = addMinutesToClock(input.time, input.durationMinutes || 60);
  const calendarId = encodeURIComponent(input.calendarId || "primary");

  const body = {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: { dateTime: `${day}T${input.time}:00`, timeZone: "Europe/London" },
    end: { dateTime: `${day}T${endTime}:00`, timeZone: "Europe/London" },
    // Tag events we created so they're identifiable in the account.
    source: { title: "The Sensory Submarine", url: "https://portal.thesensorysubmarine.com/bookings" },
  };

  try {
    const res = await fetch(`${CAL_BASE}/${calendarId}/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: unknown };
    if (!res.ok || !json.id) {
      console.error("[google] event insert failed", res.status, json.error);
      return null;
    }
    return json.id;
  } catch (err) {
    console.error("[google] event insert threw", err);
    return null;
  }
}

/** Delete a previously-created event. Returns true on success (or if the
 *  event was already gone). Best-effort — never throws. */
export async function deleteBookingEvent(args: {
  refreshToken: string;
  calendarId?: string | null;
  eventId: string;
}): Promise<boolean> {
  const accessToken = await getAccessToken(args.refreshToken);
  if (!accessToken) return false;
  const calendarId = encodeURIComponent(args.calendarId || "primary");
  try {
    const res = await fetch(
      `${CAL_BASE}/${calendarId}/events/${encodeURIComponent(args.eventId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
    );
    // 200/204 = deleted; 404/410 = already gone (treat as success).
    if (res.ok || res.status === 404 || res.status === 410) return true;
    console.error("[google] event delete failed", res.status);
    return false;
  } catch (err) {
    console.error("[google] event delete threw", err);
    return false;
  }
}

/**
 * Read a connected user's upcoming events straight from the Calendar API.
 *
 * This is the read half of the OAuth connection, and it exists to replace the
 * secret-iCal-URL route entirely. The iCal feed had three problems: the setting
 * is buried in Google (and hidden altogether on some Workspace accounts), it
 * can't be reached from the phone app at all, and Google only republishes it
 * every few hours so the portal was always stale. The API has none of that —
 * one consent click, live data.
 *
 * The `calendar.events` scope we already request covers reading events, so no
 * new consent is needed for people who have connected.
 *
 * Returns events in the same shape as the iCal parser so the team calendar can
 * merge both sources without caring which one a person uses. Returns null on
 * any failure so a single broken connection can't take the calendar down.
 */
export async function listUpcomingEvents(args: {
  refreshToken: string;
  calendarId?: string | null;
  from: Date;
  to: Date;
}): Promise<GoogleReadEvent[] | null> {
  const accessToken = await getAccessToken(args.refreshToken);
  if (!accessToken) return null;

  const calendarId = encodeURIComponent(args.calendarId || "primary");
  const params = new URLSearchParams({
    timeMin: args.from.toISOString(),
    timeMax: args.to.toISOString(),
    // Expand recurring events into individual occurrences, otherwise a weekly
    // clinic would show once instead of every week.
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  try {
    const res = await fetch(`${CAL_BASE}/${calendarId}/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.error("[google] events.list failed", res.status);
      return null;
    }
    const json = (await res.json()) as { items?: GoogleApiEvent[] };
    const items = json.items ?? [];
    return items
      .filter((e) => e.status !== "cancelled")
      .map(toReadEvent)
      .filter((e): e is GoogleReadEvent => e !== null);
  } catch (err) {
    console.error("[google] events.list threw", err);
    return null;
  }
}

/** Matches the iCal parser's event shape so both sources merge cleanly. */
export interface GoogleReadEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  /** False when the event is marked Free in Google. */
  busy: boolean;
}

interface GoogleApiEvent {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  /** "transparent" = shown as Free in Google, so it shouldn't hold a slot. */
  transparency?: string;
}

function toReadEvent(e: GoogleApiEvent): GoogleReadEvent | null {
  // All-day events carry `date` (YYYY-MM-DD); timed ones carry `dateTime`.
  const startRaw = e.start?.dateTime ?? e.start?.date;
  const endRaw = e.end?.dateTime ?? e.end?.date;
  if (!startRaw || !endRaw) return null;
  const allDay = !e.start?.dateTime;
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return null;
  }
  return {
    uid: e.id ?? `${startRaw}-${e.summary ?? ""}`,
    // Google omits summary on events with no title; the calendar shows
    // "(No title)" for these, so mirror that rather than rendering blank.
    title: e.summary?.trim() || "(No title)",
    description: e.description,
    location: e.location,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    allDay,
    // Google's "transparency" is how the event shows in your diary: an event
    // marked Free shouldn't stop a client booking that time.
    busy: e.transparency !== "transparent",
  };
}

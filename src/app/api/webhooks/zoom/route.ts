/**
 * Zoom webhook — fires when a cloud recording finishes.
 *
 * Two events matter:
 *   endpoint.url_validation — Zoom's one-time challenge when you save the
 *     webhook URL in the Marketplace app. We echo the token back HMAC'd.
 *   recording.completed     — a cloud recording is ready. We kick off the
 *     Vimeo pull-upload (Vimeo fetches the file itself).
 *
 * Every request is signature-verified with the Webhook Secret Token. This
 * route is public by necessity (Zoom can't authenticate), so the signature IS
 * the auth — /api/* is excluded from the app middleware.
 *
 * Zoom retries on non-2xx, so we always 200 once the payload is accepted and
 * do the slow work inline (the pull-upload call itself is a single fast API
 * request — Vimeo does the downloading afterwards).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  urlValidationResponse,
  verifyZoomSignature,
  type ZoomRecordingMeeting,
} from "@/lib/zoom";
import { ingestZoomRecording } from "@/lib/recording-sync";

export const dynamic = "force-dynamic";
// Vimeo's pull request returns quickly, but leave headroom.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-zm-signature");
  const timestamp = req.headers.get("x-zm-request-timestamp");

  let payload: {
    event?: string;
    payload?: { plainToken?: string; object?: ZoomRecordingMeeting };
    download_token?: string;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── Endpoint validation handshake (must answer even before verifying) ──
  if (payload.event === "endpoint.url_validation") {
    const plainToken = payload.payload?.plainToken;
    if (!plainToken) {
      return NextResponse.json({ error: "Missing plainToken" }, { status: 400 });
    }
    return NextResponse.json(urlValidationResponse(plainToken));
  }

  // ── Everything else must be signed ────────────────────────────────────
  if (!verifyZoomSignature(rawBody, signature, timestamp)) {
    console.error("[zoom-webhook] bad signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (payload.event !== "recording.completed") {
    return NextResponse.json({ received: true });
  }

  const meeting = payload.payload?.object;
  if (!meeting?.uuid) {
    return NextResponse.json({ error: "Missing recording object" }, { status: 400 });
  }

  try {
    // `download_token` is a short-lived token Zoom includes so the recording
    // can be fetched — exactly what Vimeo's pull upload needs.
    const id = await ingestZoomRecording(meeting, payload.download_token);
    return NextResponse.json({ received: true, recordingId: id });
  } catch (err) {
    console.error("[zoom-webhook] ingest failed", err);
    // 200 anyway: the payload was valid and re-delivery wouldn't help. The
    // row (if created) carries the error, and manual import can retry.
    return NextResponse.json({ received: true, error: "ingest failed" });
  }
}

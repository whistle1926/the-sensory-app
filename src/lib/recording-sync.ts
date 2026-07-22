/**
 * Zoom → Vimeo recording sync orchestration.
 *
 * Shared by the Zoom webhook (real-time, when a recording finishes) and the
 * manual "Import from Zoom" backfill, so both follow one path:
 *
 *   Zoom recording → pick the best MP4 → hand Vimeo the download URL →
 *   Vimeo pulls it → poll transcode → admin publishes it as course content.
 *
 * Everything is best-effort and idempotent on the Zoom meeting UUID, so a
 * duplicate webhook (Zoom retries) can never create a second upload.
 */
import { prisma } from "./prisma";
import {
  buildDownloadUrl,
  getMeetingRecording,
  getZoomAccessToken,
  pickBestRecordingFile,
  type ZoomRecordingMeeting,
} from "./zoom";
import { getVideoStatus, pullUpload, vimeoConfigured, whitelistDomain } from "./vimeo";

/** The domain allowed to embed these videos (the portal). */
function portalDomain(): string {
  const base =
    process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://portal.thesensorysubmarine.com";
  try {
    return new URL(base).hostname;
  } catch {
    return "portal.thesensorysubmarine.com";
  }
}

/**
 * Ingest one Zoom recording: record it, then ask Vimeo to pull the file.
 * `downloadToken` comes from the webhook payload; without it we fall back to
 * an account access token. Returns the RecordingSync row id, or null if the
 * recording had no usable video file.
 */
export async function ingestZoomRecording(
  meeting: ZoomRecordingMeeting,
  downloadToken?: string,
): Promise<string | null> {
  const uuid = meeting.uuid;
  if (!uuid) return null;

  // Idempotency: if we've already ingested this meeting, do nothing.
  const existing = await prisma.recordingSync.findUnique({
    where: { zoomMeetingUuid: uuid },
    select: { id: true, status: true },
  });
  if (existing) return existing.id;

  const file = pickBestRecordingFile(meeting.recording_files);
  const topic = meeting.topic?.trim() || "Zoom recording";
  const startedAt = meeting.start_time ? new Date(meeting.start_time) : new Date();
  const sizeMb = file?.file_size
    ? Math.round(file.file_size / (1024 * 1024))
    : meeting.total_size
      ? Math.round(meeting.total_size / (1024 * 1024))
      : null;

  const row = await prisma.recordingSync.create({
    data: {
      zoomMeetingUuid: uuid,
      zoomMeetingId: meeting.id != null ? String(meeting.id) : null,
      topic,
      startedAt,
      durationMin: meeting.duration ?? 0,
      sizeMb,
      status: file ? "pending" : "failed",
      error: file ? null : "No MP4 video file found in this Zoom recording.",
    },
  });
  if (!file?.download_url) return row.id;

  await uploadMeetingToVimeo({
    rowId: row.id,
    meeting,
    topic,
    startedAt,
    downloadToken,
  });
  return row.id;
}

/**
 * Hand one meeting's video to Vimeo and record the outcome on `rowId`.
 * Shared by the initial ingest and the Retry action, so both behave
 * identically. Never throws — failures are written to the row.
 */
async function uploadMeetingToVimeo(args: {
  rowId: string;
  meeting: ZoomRecordingMeeting;
  topic: string;
  startedAt: Date;
  downloadToken?: string;
}): Promise<void> {
  const { rowId, meeting, topic, startedAt, downloadToken } = args;
  const file = pickBestRecordingFile(meeting.recording_files);

  if (!file?.download_url) {
    await prisma.recordingSync.update({
      where: { id: rowId },
      data: { status: "failed", error: "No MP4 video file found in this Zoom recording." },
    });
    return;
  }

  if (!vimeoConfigured()) {
    await prisma.recordingSync.update({
      where: { id: rowId },
      data: { status: "failed", error: "Vimeo is not configured (missing access token)." },
    });
    return;
  }

  // Vimeo needs a URL it can fetch — Zoom download URLs require a token.
  const token = downloadToken || (await getZoomAccessToken());
  if (!token) {
    await prisma.recordingSync.update({
      where: { id: rowId },
      data: { status: "failed", error: "Could not obtain a Zoom download token." },
    });
    return;
  }

  const link = buildDownloadUrl(file.download_url, token);
  const result = await pullUpload({
    link,
    name: topic,
    description: `Recorded ${startedAt.toLocaleDateString("en-GB")} · imported from Zoom.`,
  });

  if (!result) {
    await prisma.recordingSync.update({
      where: { id: rowId },
      data: { status: "failed", error: "Vimeo rejected the upload. Check the access token, plan and scopes." },
    });
    return;
  }

  // Lock embedding to the portal so paid course content can't be re-embedded.
  await whitelistDomain(result.uri, portalDomain());

  await prisma.recordingSync.update({
    where: { id: rowId },
    data: {
      vimeoUri: result.uri,
      vimeoLink: result.link,
      status: "uploading",
      error: null,
    },
  });
}

/**
 * Re-attempt a recording that previously failed. Re-fetches the recording
 * from Zoom by meeting UUID (so it works even for meetings older than the
 * backfill window) and re-runs the Vimeo upload on the SAME row — which is
 * what the idempotency-on-UUID rule would otherwise prevent.
 *
 * Returns a human-readable error, or null on success.
 */
export async function retryRecording(id: string): Promise<string | null> {
  const row = await prisma.recordingSync.findUnique({ where: { id } });
  if (!row) return "Recording not found.";

  // Mark it in-flight straight away so the UI reflects the retry.
  await prisma.recordingSync.update({
    where: { id },
    data: { status: "pending", error: null },
  });

  const meeting = await getMeetingRecording(row.zoomMeetingUuid);
  if (!meeting) {
    const msg =
      "Couldn't fetch this recording from Zoom — it may have been deleted there, or Zoom access isn't working.";
    await prisma.recordingSync.update({
      where: { id },
      data: { status: "failed", error: msg },
    });
    return msg;
  }

  await uploadMeetingToVimeo({
    rowId: id,
    meeting,
    topic: row.topic,
    startedAt: row.startedAt,
  });

  const after = await prisma.recordingSync.findUnique({
    where: { id },
    select: { status: true, error: true },
  });
  return after?.status === "failed" ? (after.error ?? "Retry failed.") : null;
}

/**
 * Poll Vimeo for anything still in flight and advance its status. Called when
 * the admin opens the Recordings page — cheap, and avoids needing a cron
 * (Vercel's 2-cron cap is already used).
 */
export async function refreshRecordingStatuses(): Promise<void> {
  if (!vimeoConfigured()) return;
  const inFlight = await prisma.recordingSync.findMany({
    where: { status: { in: ["uploading", "transcoding"] }, vimeoUri: { not: null } },
    select: { id: true, vimeoUri: true },
    take: 20,
  });
  await Promise.all(
    inFlight.map(async (r) => {
      try {
        const s = await getVideoStatus(r.vimeoUri!);
        if (!s) return;
        let status: string | null = null;
        let error: string | null = null;
        if (s.uploadStatus === "error" || s.transcodeStatus === "error") {
          status = "failed";
          error = "Vimeo failed to process the video.";
        } else if (s.transcodeStatus === "complete") {
          status = "ready";
        } else if (s.uploadStatus === "complete") {
          status = "transcoding";
        }
        if (status) {
          await prisma.recordingSync.update({
            where: { id: r.id },
            data: { status, error, ...(s.link ? { vimeoLink: s.link } : {}) },
          });
        }
      } catch {
        /* best-effort */
      }
    }),
  );
}

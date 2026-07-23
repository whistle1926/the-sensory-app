/**
 * Client-side direct upload to Vercel Blob.
 *
 * WHY THIS EXISTS: posting a file through a normal API route hits Vercel's
 * ~4.5 MB request-body limit, and the failure happens at the platform edge —
 * the handler never runs, so the browser just hangs. That's exactly what
 * broke uploading a PDF/PowerPoint as a lesson resource.
 *
 * Here the browser uploads STRAIGHT to Blob storage and this route only
 * signs the request, so the body limit never applies and big handouts work.
 *
 * Auth still happens here: onBeforeGenerateToken runs on the server with the
 * user's cookies, so only staff can ever get an upload token.
 */
import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB — plenty for slides/handouts

// Documents + images. Deliberately no executables.
const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth();
        if (!session?.user || !isStaff(session.user.role)) {
          throw new Error("Not allowed to upload.");
        }
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        };
      },
      // Nothing to do on completion — the caller stores the returned URL
      // against the recording/live session itself.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

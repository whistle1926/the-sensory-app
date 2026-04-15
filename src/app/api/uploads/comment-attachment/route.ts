import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";

// 50 MB is a reasonable ceiling for short videos / photos.
const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_PREFIXES = ["image/", "video/"];

/**
 * Uploads a single image/video to Vercel Blob and returns metadata the
 * caller then attaches to a new comment via POST /api/tasks/[taskId]/comments.
 *
 * Auth: any signed-in user. We don't know which task the file belongs to yet —
 * abuse is limited because the file is only wired into a visible comment on
 * a task the caller already has access to.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File is too large (max 50 MB)" },
      { status: 400 }
    );
  }
  if (!ALLOWED_PREFIXES.some((p) => file.type.startsWith(p))) {
    return NextResponse.json(
      { error: "Only images and videos are allowed" },
      { status: 400 }
    );
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "upload";
  const key = `task-comments/${session.user.id}/${Date.now()}-${safeName}`;

  const { url } = await put(key, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });

  return NextResponse.json({
    url,
    mimeType: file.type,
    filename: file.name,
    sizeBytes: file.size,
  });
}

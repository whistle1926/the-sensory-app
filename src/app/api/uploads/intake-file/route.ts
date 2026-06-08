/**
 * Staff upload for client assessment / intake result files (e.g. the
 * completed SPM PDF). Same Vercel Blob pattern as the leaflet upload,
 * but stored under a `client-intake/` prefix so client documents are
 * kept separate from the public leaflet library.
 *
 * Returns { url, filename, mimeType, sizeBytes } — the caller stores
 * `url` on the ClientIntakeItem.fileUrl field.
 */
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — assessment PDFs can be chunky

const ALLOWED_PREFIXES = [
  "image/",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "text/plain",
];

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!isStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 400 },
    );
  }
  if (!ALLOWED_PREFIXES.some((p) => file.type.startsWith(p))) {
    return NextResponse.json(
      { error: `File type not allowed: ${file.type || "unknown"}` },
      { status: 400 },
    );
  }

  const safeName =
    file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "assessment";
  const key = `client-intake/${Date.now()}-${safeName}`;

  const { url } = await put(key, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });

  return NextResponse.json({
    url,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });
}

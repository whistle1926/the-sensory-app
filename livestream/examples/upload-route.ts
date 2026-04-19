// Example /api/upload route used by the admin form's logo/media upload buttons.
// Accepts FormData { file, bucket, folder } and uploads to Supabase Storage.
// Place at app/api/upload/route.ts.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET_MIME = {
  images: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  "live-media": ["video/mp4", "video/webm"],
} as const;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const bucket = (form.get("bucket") as string | null) ?? "images";
  const folder = (form.get("folder") as string | null) ?? "";

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  const allowed = (BUCKET_MIME as Record<string, readonly string[]>)[bucket];
  if (!allowed || !allowed.includes(file.type)) {
    return NextResponse.json(
      { error: `File type '${file.type}' not allowed for bucket '${bucket}'` },
      { status: 400 },
    );
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const key = `${folder ? folder + "/" : ""}${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from(bucket).upload(key, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data } = admin.storage.from(bucket).getPublicUrl(key);
  return NextResponse.json({ url: data.publicUrl });
}

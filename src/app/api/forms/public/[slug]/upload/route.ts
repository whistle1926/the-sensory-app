import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — comfortable for PDFs and phone photos

// Prefixes we allow on anonymous public form uploads. Tight on
// purpose: any document format that supports macros (Word .doc,
// Excel .xls) is a classic phishing payload — we don't want a public
// upload turning the blob bucket into a malware host. PDFs are
// readable but inert; legacy Office formats are excluded; modern
// Office (.docx / .xlsx) is left out too to keep the surface small
// (parents on phones submit photos / PDFs in practice, not Word).
const ALLOWED_PREFIXES = [
  "image/",
  "application/pdf",
  "text/plain",
  "video/",
];

// In-memory per-IP rate limit; see submit/route.ts for rationale.
const RECENT = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_IN_WINDOW = 8; // slightly higher than submits — users may retry uploads

function rateLimit(key: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const arr = (RECENT.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_IN_WINDOW) {
    return {
      ok: false,
      retryAfter: Math.ceil((arr[0] + WINDOW_MS - now) / 1000),
    };
  }
  arr.push(now);
  RECENT.set(key, arr);
  return { ok: true };
}

function ipFromRequest(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Confirm the form exists and accepts responses — stops random unauth uploads
  // being used as a free file host.
  const form = await prisma.form.findUnique({
    where: { slug },
    select: { id: true, isPublished: true },
  });
  if (!form || !form.isPublished) {
    return NextResponse.json(
      { error: "This form is no longer accepting responses." },
      { status: 404 },
    );
  }

  const ip = ipFromRequest(req);
  const rl = rateLimit(`${form.id}:${ip}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many uploads — please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } },
    );
  }

  const form_ = await req.formData().catch(() => null);
  const file = form_?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File is too large (max ${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 400 },
    );
  }
  if (!ALLOWED_PREFIXES.some((p) => file.type.startsWith(p))) {
    return NextResponse.json(
      { error: `File type not allowed: ${file.type || "unknown"}` },
      { status: 400 },
    );
  }

  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 12);
  const safeName =
    file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "upload";
  const key = `form-uploads/${form.id}/${Date.now()}-${ipHash}-${safeName}`;

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

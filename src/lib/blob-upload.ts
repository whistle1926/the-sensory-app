import { put } from "@vercel/blob";

/**
 * Fetch a remote URL (e.g. an ephemeral Replicate CDN URL) and re-host the
 * bytes on Vercel Blob so we own a permanent URL. Returns the Blob public URL.
 *
 * Throws if the upstream 404s, the file exceeds `maxBytes`, or Blob rejects
 * the upload.
 */
export async function rehostToBlob(
  sourceUrl: string,
  opts: {
    pathPrefix: string; // e.g. "programme-demos"
    filenameHint?: string; // e.g. "step-1.webp"
    maxBytes?: number; // default 5 MB
    allowedPrefixes?: string[]; // default ["image/"]
  },
): Promise<{ url: string; contentType: string; sizeBytes: number }> {
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024;
  const allowed = opts.allowedPrefixes ?? ["image/"];

  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`Source URL returned ${res.status}`);
  }

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  if (!allowed.some((p) => contentType.startsWith(p))) {
    throw new Error(`Rejected content-type: ${contentType}`);
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    throw new Error(
      `Source too large: ${buffer.byteLength} bytes (max ${maxBytes})`,
    );
  }

  const extFromType = contentType.split("/")[1]?.split(";")[0] || "bin";
  const base = (opts.filenameHint ?? `file.${extFromType}`)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
  const key = `${opts.pathPrefix}/${Date.now()}-${base}`;

  const { url } = await put(key, Buffer.from(buffer), {
    access: "public",
    addRandomSuffix: true,
    contentType,
  });

  return { url, contentType, sizeBytes: buffer.byteLength };
}

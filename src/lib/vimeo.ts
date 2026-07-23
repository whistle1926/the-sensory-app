/**
 * Vimeo integration — receives Zoom recordings and hosts them for the course
 * platform.
 *
 * KEY DESIGN POINT: we use Vimeo's "pull" upload approach. We hand Vimeo a
 * URL and VIMEO's servers download the file. Our serverless function never
 * touches the video bytes — essential, because course recordings are often
 * multi-GB and would blow straight past Vercel's memory/time limits if we
 * proxied them.
 *
 * Privacy: uploads default to embed-only + a domain whitelist, so paid course
 * content can't be watched on vimeo.com or embedded on someone else's site.
 * (`view: "disable"` needs a higher Vimeo tier; we fall back to "unlisted".)
 *
 * Env: VIMEO_ACCESS_TOKEN — personal access token with upload+edit scopes.
 */
const API = "https://api.vimeo.com";
// Pin the API version so Vimeo can't change response shapes under us.
const ACCEPT = "application/vnd.vimeo.*+json;version=3.4";

export function vimeoConfigured(): boolean {
  return Boolean(process.env.VIMEO_ACCESS_TOKEN);
}

async function vimeoFetch(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.VIMEO_ACCESS_TOKEN ?? ""}`,
      Accept: ACCEPT,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

export interface VimeoUploadResult {
  uri: string; // "/videos/123456789"
  link: string; // "https://vimeo.com/123456789"
}

/**
 * Ask Vimeo to PULL a video from `link` (the Zoom download URL). Returns as
 * soon as Vimeo accepts the job — transcoding happens asynchronously, so poll
 * getVideoStatus() afterwards. Returns null on failure.
 */
export async function pullUpload(args: {
  link: string;
  name: string;
  description?: string;
}): Promise<VimeoUploadResult | null> {
  if (!vimeoConfigured()) return null;

  // Try the strictest privacy first; some plans reject "disable".
  for (const view of ["disable", "unlisted"] as const) {
    const { ok, status, json } = await vimeoFetch("/me/videos", {
      method: "POST",
      body: JSON.stringify({
        upload: { approach: "pull", link: args.link },
        name: args.name,
        description: args.description ?? "",
        privacy: { view, embed: "whitelist", download: false, add: false },
      }),
    });
    if (ok && typeof json.uri === "string") {
      return {
        uri: json.uri,
        link:
          typeof json.link === "string"
            ? json.link
            : `https://vimeo.com/${json.uri.split("/").pop()}`,
      };
    }
    // 400 on privacy → retry with the softer setting; anything else, bail.
    const msg = String(json.error ?? json.developer_message ?? "");
    console.error("[vimeo] pull upload failed", status, msg, "(view=" + view + ")");
    if (status !== 400) return null;
  }
  return null;
}

/** Whitelist a domain so the video can be embedded on the portal only. */
export async function whitelistDomain(uri: string, domain: string): Promise<void> {
  const id = uri.split("/").pop();
  if (!id) return;
  const { ok, status } = await vimeoFetch(
    `/videos/${id}/privacy/domains/${encodeURIComponent(domain)}`,
    { method: "PUT" },
  );
  if (!ok) console.error("[vimeo] whitelist domain failed", status, domain);
}

/**
 * Set a custom thumbnail (poster frame) on a video from an image URL.
 *
 * Vimeo's picture flow is three steps: create a picture resource (which
 * returns a one-time upload link), PUT the image bytes to that link, then
 * mark it active. We fetch the image server-side from `imageUrl` (our own
 * Blob storage) — thumbnails are small, so this is safe to proxy, unlike the
 * videos themselves.
 *
 * Best-effort: returns an error string on failure, or null on success.
 */
export async function setThumbnail(
  uri: string,
  imageUrl: string,
): Promise<string | null> {
  if (!vimeoConfigured()) return "Vimeo is not configured.";
  const id = uri.split("/").pop();
  if (!id) return "Bad Vimeo video reference.";

  try {
    // 1. Create the picture resource → gives us a one-time upload link.
    const created = await vimeoFetch(`/videos/${id}/pictures`, { method: "POST" });
    const link = created.json.link as string | undefined;
    const pictureUri = created.json.uri as string | undefined;
    if (!created.ok || !link || !pictureUri) {
      console.error("[vimeo] create picture failed", created.status, created.json.error);
      return "Vimeo wouldn't accept a new thumbnail for this video.";
    }

    // 2. Fetch the image and PUT the bytes to Vimeo's upload link. The link
    //    is pre-signed, so it takes no Authorization header.
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return "Couldn't read the uploaded image.";
    const bytes = await imgRes.arrayBuffer();
    const put = await fetch(link, {
      method: "PUT",
      body: bytes,
      headers: {
        "Content-Type": imgRes.headers.get("content-type") ?? "image/jpeg",
      },
    });
    if (!put.ok) {
      console.error("[vimeo] thumbnail PUT failed", put.status);
      return "Uploading the thumbnail to Vimeo failed.";
    }

    // 3. Activate it — until this, the picture exists but isn't used.
    const activated = await vimeoFetch(pictureUri, {
      method: "PATCH",
      body: JSON.stringify({ active: true }),
    });
    if (!activated.ok) {
      console.error("[vimeo] thumbnail activate failed", activated.status);
      return "The thumbnail uploaded but Vimeo wouldn't set it as active.";
    }
    return null;
  } catch (err) {
    console.error("[vimeo] setThumbnail threw", err);
    return "Something went wrong setting the thumbnail.";
  }
}

/**
 * Rename the video on Vimeo so its title matches what we show in the app —
 * otherwise the Zoom auto-name ("X's Zoom Meeting") sticks around on Vimeo
 * forever. Best-effort: returns an error string, or null on success.
 */
export async function renameVideo(
  uri: string,
  name: string,
): Promise<string | null> {
  if (!vimeoConfigured()) return "Vimeo is not configured.";
  const { ok, status } = await vimeoFetch(uri, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  if (!ok) {
    console.error("[vimeo] rename failed", status);
    return "Renamed here, but Vimeo wouldn't update the video title.";
  }
  return null;
}

export interface VimeoStatus {
  /** Vimeo's transcode state: "in_progress" | "complete" | "error". */
  transcodeStatus: string | null;
  /** Upload state: "in_progress" | "complete" | "error". */
  uploadStatus: string | null;
  link: string | null;
}

/** Poll a video's processing state. */
export async function getVideoStatus(uri: string): Promise<VimeoStatus | null> {
  if (!vimeoConfigured()) return null;
  const { ok, json } = await vimeoFetch(
    `${uri}?fields=uri,link,transcode.status,upload.status`,
  );
  if (!ok) return null;
  const transcode = json.transcode as { status?: string } | undefined;
  const upload = json.upload as { status?: string } | undefined;
  return {
    transcodeStatus: transcode?.status ?? null,
    uploadStatus: upload?.status ?? null,
    link: typeof json.link === "string" ? json.link : null,
  };
}

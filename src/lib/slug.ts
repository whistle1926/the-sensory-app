// Tiny slug helper used by forms (and anything else that wants one).
// Keeps characters URL-safe and appends a short random suffix to avoid
// collisions. Re-tries in the calling code only if the DB @unique rejects.

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // strip punctuation
    .replace(/\s+/g, "-") // spaces -> dashes
    .replace(/-+/g, "-") // collapse repeats
    .replace(/^-|-$/g, "") // trim leading/trailing
    .slice(0, 40); // cap length
}

function randomSuffix(len = 4): string {
  const chars = "abcdefghijkmnopqrstuvwxyz23456789"; // no ambiguous chars
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function makeSlug(title: string): string {
  const base = slugify(title) || "form";
  return `${base}-${randomSuffix()}`;
}

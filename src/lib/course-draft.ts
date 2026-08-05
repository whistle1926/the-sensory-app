/**
 * Draft vs published course content.
 *
 * The Course columns are what parents see. `Course.draft` is a partial overlay
 * of unpublished edits. The editor autosaves into the draft, so an OT can
 * rewrite a course that is currently on sale without a half-finished sentence
 * appearing on the live page while a parent is reading it. Pressing Publish
 * copies the draft onto the real columns and empties it.
 *
 * Only content fields are drafted. Whether a course is on sale at all
 * (`status`, `isLive`) stays immediate — those are the switch, not the copy,
 * and hiding a course needs to take effect the moment it's pressed.
 */

/** Content fields that go through draft → publish. */
export const DRAFT_FIELDS = [
  "title",
  "audience",
  "duration",
  "description",
  "level",
  "price",
  "tagline",
  "shortDescription",
  "heroImageUrl",
  "thumbnailUrl",
  "features",
  "instructorName",
  "instructorRole",
  "instructorBio",
  "instructorImageUrl",
  "audienceFor",
  "testimonials",
  "isFeatured",
  "isBestseller",
] as const;

export type DraftField = (typeof DRAFT_FIELDS)[number];

/** Keep only known content fields, so a stray key can't reach the DB. */
export function cleanDraft(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of DRAFT_FIELDS) {
    if (k in src && src[k] !== undefined) out[k] = src[k];
  }
  return out;
}

/**
 * The published record with any unpublished edits laid over it — i.e. what the
 * page WOULD look like if published now. Used for the editor's preview.
 */
export function withDraft<T extends Record<string, unknown>>(
  course: T,
  draft: unknown,
): T {
  const d = cleanDraft(draft);
  return Object.keys(d).length ? ({ ...course, ...d } as T) : course;
}

/**
 * Which fields actually differ from what's published. Drives the "unpublished
 * changes" indicator — an autosave that changed nothing shouldn't light it up.
 */
export function changedFields(
  course: Record<string, unknown>,
  draft: unknown,
): DraftField[] {
  const d = cleanDraft(draft);
  const out: DraftField[] = [];
  for (const k of Object.keys(d) as DraftField[]) {
    const a = JSON.stringify(course[k] ?? null);
    const b = JSON.stringify(d[k] ?? null);
    if (a !== b) out.push(k);
  }
  return out;
}

/** Human labels for the change list, so the editor can say what's pending. */
export const FIELD_LABELS: Record<DraftField, string> = {
  title: "Title",
  audience: "Audience",
  duration: "Duration",
  description: "Description",
  level: "Level",
  price: "Price",
  tagline: "Tagline",
  shortDescription: "Card blurb",
  heroImageUrl: "Cover image",
  thumbnailUrl: "Thumbnail",
  features: "What you'll learn",
  instructorName: "Instructor name",
  instructorRole: "Instructor role",
  instructorBio: "Instructor bio",
  instructorImageUrl: "Instructor photo",
  audienceFor: "Who this is for",
  testimonials: "Testimonials",
  isFeatured: "Featured",
  isBestseller: "Bestseller",
};

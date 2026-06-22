// Shared rendering helpers for a form submission's answers. Used by both
// the "Forward to OT" email and the printable/download view so the two
// stay in sync.
import { isLayoutOnly, type FormField, type UploadedFile } from "@/lib/forms";

/** One entry in a submission's forward/share history. */
export interface ForwardLogEntry {
  to: string;
  note?: string;
  sentByName?: string;
  sentAt: string; // ISO timestamp
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render one submitted value as safe HTML (string, list, or file link). */
export function renderSubmissionValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return '<span style="color:#9ca3af;">—</span>';
  }
  if (Array.isArray(value)) {
    return escapeHtml(value.map(String).join(", "));
  }
  if (typeof value === "object") {
    const uf = value as UploadedFile;
    if (uf.url && uf.filename) {
      return `<a href="${escapeHtml(uf.url)}" style="color:#2563eb;">${escapeHtml(
        uf.filename,
      )}</a>`;
    }
    return escapeHtml(JSON.stringify(value));
  }
  // Preserve line breaks in long-text answers.
  return escapeHtml(String(value)).replace(/\n/g, "<br/>");
}

/**
 * Build the `<tr>` rows for a submission from its field snapshot, skipping
 * layout-only fields (headings/paragraphs) that carry no answer.
 */
export function submissionAnswerRowsHtml(
  snapshot: FormField[],
  data: Record<string, unknown>,
): string {
  return snapshot
    .filter((f) => f && f.type && !isLayoutOnly(f.type))
    .map((field) => {
      const label = escapeHtml(field.label || "(Untitled)");
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;color:#374151;width:40%;vertical-align:top;">${label}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#111827;">${renderSubmissionValue(
          data[field.id],
        )}</td>
      </tr>`;
    })
    .join("");
}

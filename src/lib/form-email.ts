/**
 * Shared renderer for form-invite emails (manual "Send form" dialog AND the
 * automated post-appointment feedback send), so both produce identical,
 * properly-formatted email bodies.
 *
 * Admins write the copy as plain text in the form builder / Send dialog.
 * This turns it into HTML:
 *   - blank lines become paragraphs
 *   - `**bold**` becomes <strong>
 *   - the link placeholder becomes the branded button, IN PLACE
 *
 * The link placeholder is whichever the admin used: `{{formUrl}}` or a
 * literal "[Insert Feedback Form Link]" pasted from a draft. Matching it
 * here is what stops the raw placeholder text ever reaching a client — the
 * bug Grace hit, where the email showed "**Complete the feedback form
 * here:** [Insert Feedback Form Link]" above a separately-appended button.
 */
import { escapeHtml } from "@/lib/email";

/** Matches any supported link placeholder, however the admin wrote it. */
const LINK_PLACEHOLDER =
  /\{\{\s*formUrl\s*\}\}|\[\s*insert\s+(?:the\s+)?(?:feedback\s+)?form\s+link\s*\]|\[\s*form\s+link\s*\]|\[\s*insert\s+link\s*\]/i;

/** Escape, then apply light inline formatting (**bold**, {{formTitle}}, breaks). */
function inline(text: string, formTitle: string): string {
  let out = escapeHtml(text.replace(/\{\{\s*formTitle\s*\}\}/g, formTitle));
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\n/g, "<br/>");
  return out;
}

function linkButton(formUrl: string, label: string): string {
  return `<a href="${escapeHtml(
    formUrl,
  )}" style="display:inline-block;background:#1a1a2e;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;">${escapeHtml(
    label,
  )}</a>`;
}

/**
 * Render an admin-authored plain-text body into branded email HTML.
 * The button is placed where the admin put the placeholder; if they removed
 * it entirely, the button is appended so the email always has a live link.
 */
export function renderFormEmailBody(
  body: string,
  formUrl: string,
  formTitle: string,
): string {
  const button = linkButton(formUrl, formTitle);
  const paras = body.replace(/\r\n/g, "\n").split(/\n{2,}/);
  let linkPlaced = false;

  const htmlParas = paras.map((p) => {
    if (!LINK_PLACEHOLDER.test(p)) {
      return `<p style="margin:0 0 14px;">${inline(p, formTitle)}</p>`;
    }
    linkPlaced = true;
    // Keep any text the admin wrote around the placeholder (e.g. a heading
    // line above it), then drop the button in its place.
    const [before, after = ""] = p.split(LINK_PLACEHOLDER);
    const beforeHtml = before.trim()
      ? `<p style="margin:0 0 12px;">${inline(before.trim(), formTitle)}</p>`
      : "";
    const afterHtml = after.trim()
      ? `<p style="margin:0 0 14px;">${inline(after.trim(), formTitle)}</p>`
      : "";
    return `${beforeHtml}<p style="margin:0 0 18px;">${button}</p>${afterHtml}`;
  });

  if (!linkPlaced) htmlParas.push(`<p style="margin:0 0 18px;">${button}</p>`);
  return htmlParas.join("\n");
}

/** The small grey "if the button doesn't work" fallback line. */
export function fallbackLinkHtml(formUrl: string): string {
  return `<p style="margin:18px 0 0;font-size:11px;color:#999999;">If the button doesn't work, copy and paste this link:<br/><a href="${escapeHtml(
    formUrl,
  )}" style="color:#999999;">${escapeHtml(formUrl)}</a></p>`;
}

/** True if the body already places the link itself (so callers know not to
 * append a second button). Exported for callers that build their own HTML. */
export function bodyPlacesLink(body: string): boolean {
  return LINK_PLACEHOLDER.test(body);
}

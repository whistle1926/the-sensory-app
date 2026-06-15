/**
 * Rendering helpers for standalone Home Programmes.
 *
 * The body is plain text in the same format the in-report
 * HomeProgrammeEditor produces (bullet lines, leaflet blocks with
 * URLs). These helpers turn that into branded HTML for two channels:
 *   - a printable page (used by the /pdf route — print-to-PDF, same
 *     approach as the report PDF)
 *   - an inline-styled email body (used by the /send route via Mailcub)
 *
 * Kept deliberately small: one escape, one linkify, two templates.
 */

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A line that is solely an image URL — the demo-step photos carried
 * over from a programme template (public Vercel Blob .webp/.png/etc.).
 */
const IMAGE_URL_RE =
  /^(https?:\/\/[^\s"'<>]+\.(?:webp|png|jpe?g|gif|avif))(?:\?[^\s"'<>]*)?$/i;

/** True when a (trimmed) line is just an image URL we should render as a photo. */
export function isImageUrl(line: string): boolean {
  return IMAGE_URL_RE.test(line.trim());
}

/**
 * Render the plain-text body to HTML for print/email. Processed
 * line-by-line so that:
 *   - a line that is solely an image URL (a demo-step photo) becomes an
 *     inline <img> figure,
 *   - other URLs (e.g. leaflet links) stay clickable,
 *   - everything else is escaped text.
 * This is what lets the step-by-step demo photos travel with the
 * programme into the PDF and the parent's email.
 */
export function bodyToHtml(body: string): string {
  return (body || "")
    .split("\n")
    .map((raw) => {
      const trimmed = raw.trim();
      if (isImageUrl(trimmed)) {
        return `<img src="${trimmed}" alt="Demo step" style="display:block;max-width:320px;width:100%;height:auto;border-radius:8px;margin:8px 0;border:1px solid #e5e7eb;" />`;
      }
      const escaped = escapeHtml(raw);
      return escaped.replace(
        /(https?:\/\/[^\s<]+)/g,
        (url) => `<a href="${url}" style="color:#2563eb;">${url}</a>`,
      );
    })
    .join("<br/>");
}

interface HomeProgrammeView {
  title: string;
  body: string;
  clientName: string;
  therapistName: string;
  /** Pre-formatted date string, e.g. "12 June 2026". */
  dateLabel: string;
}

/** Full branded HTML page for printing / saving as PDF. */
export function homeProgrammeHtml(v: HomeProgrammeView): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(v.title)} — ${escapeHtml(v.clientName)}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; }
    .brand-logo { display: block; margin: 0 auto 12px; width: 140px; height: auto; }
    h1 { text-align: center; font-size: 18pt; margin-bottom: 4px; }
    .subtitle { text-align: center; color: #666; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    td { border: 1px solid #ccc; padding: 6px 10px; font-size: 10pt; }
    td.label { background: #f3f4f6; font-weight: bold; width: 35%; }
    .body { white-space: normal; font-size: 11pt; }
    .footer { border-top: 1px solid #ccc; margin-top: 30px; padding-top: 12px; font-size: 10pt; }
    .confidential { font-size: 9pt; color: #999; font-style: italic; margin-top: 16px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <img src="/brand/logo.jpg" alt="The Sensory Submarine" class="brand-logo" />
  <h1>${escapeHtml(v.title)}</h1>
  <p class="subtitle">The Sensory Submarine</p>

  <table>
    <tr><td class="label">Prepared for</td><td>${escapeHtml(v.clientName)}</td></tr>
    <tr><td class="label">Prepared by</td><td>${escapeHtml(v.therapistName)}</td></tr>
    <tr><td class="label">Date</td><td>${escapeHtml(v.dateLabel)}</td></tr>
  </table>

  <div class="body">${bodyToHtml(v.body)}</div>

  <div class="footer">
    <p class="confidential">This home programme is confidential and intended for the named recipient(s) only. If you have received it in error, please contact The Sensory Submarine immediately.</p>
  </div>
</body>
</html>`;
}

interface HomeProgrammeEmail extends HomeProgrammeView {
  senderName: string;
  /** Optional personal note shown above the programme. */
  message: string;
  /** When true, `message` is already HTML from a rich editor. */
  isHtml: boolean;
}

/** Inline-styled HTML email carrying the home programme. */
export function homeProgrammeEmailHtml(v: HomeProgrammeEmail): string {
  const messageBlock = v.isHtml
    ? `<div style="margin:0 0 20px 0;line-height:1.6;color:#333;">${v.message}</div>`
    : v.message
      ? `<p style="margin:0 0 20px 0;line-height:1.6;color:#333;">${escapeHtml(v.message).replace(/\n/g, "<br/>")}</p>`
      : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="text-align:center;padding:8px 0 12px;">
      <img src="https://portal.thesensorysubmarine.com/brand/logo.jpg"
           alt="The Sensory Submarine"
           width="120" height="120"
           style="display:inline-block;width:120px;height:auto;border:0;outline:none;" />
    </div>
    <div style="background:#1a1a2e;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(v.senderName)}</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:0.7;">${escapeHtml(v.title)}</p>
    </div>
    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">
      ${messageBlock}
      <div style="background:#f0f4ff;border-radius:8px;padding:16px 20px;margin:0 0 20px 0;">
        <p style="margin:0;font-size:14px;color:#555;">
          <strong>For:</strong> ${escapeHtml(v.clientName)}<br/>
          <strong>Date:</strong> ${escapeHtml(v.dateLabel)}
        </p>
      </div>
      <div style="margin:24px 0 0;">
        <div style="background:#1a1a2e;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0;text-align:center;">
          <h2 style="margin:0;font-size:17px;font-weight:700;color:#fff;">${escapeHtml(v.title)}</h2>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;font-size:13px;line-height:1.7;color:#444;">
          ${bodyToHtml(v.body)}
        </div>
      </div>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
      <p style="margin:0;font-size:12px;color:#999;text-align:center;">
        ${escapeHtml(v.senderName)} &middot; Occupational Therapy Services
      </p>
    </div>
  </div>
</body>
</html>`;
}

/** Plain-text fallback for email clients that won't render HTML. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>(?=)/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Rendering helpers for standalone Letters (school summaries, statutory
 * assessment support, advice to schools, etc.).
 *
 * A letter is freeform rich text with the practice letterhead applied on
 * export/email. The body sanitising + email plumbing is shared with home
 * programmes — only the page layout differs (a formal letter rather than a
 * programme sheet), so those helpers are imported rather than duplicated.
 */
import { escapeHtml, bodyToHtml, htmlToText } from "@/lib/home-programme";

export { htmlToText };

interface LetterView {
  title: string;
  body: string;
  /** Who the letter is addressed to (a school, a panel). May be empty. */
  recipient: string;
  /** The child the letter concerns, or "—" when not linked. */
  clientName: string;
  therapistName: string;
  /** Pre-formatted date, e.g. "1 September 2026". */
  dateLabel: string;
}

/**
 * Full branded, printable letter — opened in a new tab and saved as PDF,
 * the same print-to-PDF approach the report and home-programme exports use.
 * Laid out as a formal letter: letterhead, date, recipient, then the body
 * (which carries its own salutation and sign-off).
 */
export function letterHtml(v: LetterView): string {
  const recipientBlock = v.recipient.trim()
    ? `<p class="recipient">${escapeHtml(v.recipient).replace(/\n/g, "<br/>")}</p>`
    : "";
  const reLine =
    v.clientName && v.clientName !== "—"
      ? `<p class="re"><strong>Re:</strong> ${escapeHtml(v.clientName)}</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(v.title)}${v.clientName && v.clientName !== "—" ? ` — ${escapeHtml(v.clientName)}` : ""}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; }
    .head { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #12235b; padding-bottom: 14px; margin-bottom: 24px; }
    .brand-logo { width: 96px; height: auto; }
    .brand-name { font-size: 15pt; font-weight: bold; color: #12235b; }
    .brand-meta { font-size: 9pt; color: #666; text-align: right; }
    .date { text-align: right; margin: 0 0 18px; }
    .recipient { white-space: normal; margin: 0 0 18px; }
    .re { margin: 0 0 18px; }
    .body { font-size: 11pt; }
    .body p { margin: 0 0 12px; }
    .body h2 { font-size: 12.5pt; color: #12235b; margin: 20px 0 6px; }
    .body ul, .body ol { margin: 0 0 12px; padding-left: 22px; }
    .body li { margin: 0 0 4px; }
    .footer { border-top: 1px solid #ccc; margin-top: 34px; padding-top: 12px; font-size: 10pt; }
    .confidential { font-size: 9pt; color: #999; font-style: italic; margin-top: 16px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="head">
    <img src="/brand/logo.jpg" alt="The Sensory Submarine" class="brand-logo" />
    <div class="brand-meta">
      <div class="brand-name">The Sensory Submarine</div>
      Occupational Therapy Services<br/>
      www.thesensorysubmarine.com
    </div>
  </div>

  <p class="date">${escapeHtml(v.dateLabel)}</p>
  ${recipientBlock}
  ${reLine}

  <div class="body">${bodyToHtml(v.body)}</div>

  <div class="footer">
    <p class="confidential">This letter is confidential and intended for the named recipient(s) only. If you have received it in error, please contact The Sensory Submarine immediately.</p>
  </div>
</body>
</html>`;
}

interface LetterEmail extends LetterView {
  senderName: string;
  /** Optional covering note shown above the letter. */
  message: string;
  isHtml: boolean;
}

/** Inline-styled HTML email carrying the letter, branded like the
 *  home-programme email so the two feel of a piece. */
export function letterEmailHtml(v: LetterEmail): string {
  const messageBlock = v.isHtml
    ? `<div style="margin:0 0 20px 0;line-height:1.6;color:#333;">${v.message}</div>`
    : v.message
      ? `<p style="margin:0 0 20px 0;line-height:1.6;color:#333;">${escapeHtml(v.message).replace(/\n/g, "<br/>")}</p>`
      : "";

  const reBlock =
    v.clientName && v.clientName !== "—"
      ? `<div style="background:#f0f4ff;border-radius:8px;padding:16px 20px;margin:0 0 20px 0;">
        <p style="margin:0;font-size:14px;color:#555;">
          <strong>Re:</strong> ${escapeHtml(v.clientName)}<br/>
          <strong>Date:</strong> ${escapeHtml(v.dateLabel)}
        </p>
      </div>`
      : `<p style="margin:0 0 20px 0;font-size:14px;color:#555;"><strong>Date:</strong> ${escapeHtml(v.dateLabel)}</p>`;

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
      ${reBlock}
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:24px;font-size:13px;line-height:1.7;color:#444;">
        ${bodyToHtml(v.body)}
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

/**
 * Starter scaffolds for the "New letter" chooser. Deliberately skeletons
 * with [bracketed placeholders] the OT fills in — never fabricated clinical
 * content. `blank` returns an empty body so the letterhead alone frames it.
 */
export const LETTER_TEMPLATES: Record<
  string,
  { label: string; title: string; body: string }
> = {
  blank: { label: "Blank letter", title: "Letter", body: "" },
  "school-summary": {
    label: "School summary & recommendations",
    title: "OT summary & recommendations for school",
    body: `<p>To whom it may concern,</p>
<p>[Child's name] (date of birth [DOB]) has been attending occupational therapy at The Sensory Submarine. This letter provides a brief summary of how [he/she/they] is getting on, along with recommended strategies for use in school.</p>
<h2>Background</h2>
<p>[Brief background and reason for OT involvement.]</p>
<h2>Current presentation</h2>
<p>[Summary of the child's current strengths and areas of difficulty.]</p>
<h2>Recommended strategies for school</h2>
<ul><li>[Strategy one]</li><li>[Strategy two]</li><li>[Strategy three]</li></ul>
<p>Please do not hesitate to contact me if you would like to discuss any of the above.</p>
<p>Yours faithfully,</p>
<p>[Your name]<br/>Occupational Therapist</p>`,
  },
  "statutory-assessment": {
    label: "Statutory assessment support",
    title: "Letter in support of statutory assessment",
    body: `<p>To whom it may concern,</p>
<p>I am writing in support of a request for statutory assessment for [child's name] (date of birth [DOB]).</p>
<h2>Occupational therapy involvement</h2>
<p>[Summary of your involvement and assessment findings.]</p>
<h2>Impact on access to education</h2>
<p>[How the child's difficulties affect participation and learning in school.]</p>
<h2>Recommendations</h2>
<ul><li>[Recommendation one]</li><li>[Recommendation two]</li></ul>
<p>I would be happy to provide any further information required.</p>
<p>Yours faithfully,</p>
<p>[Your name]<br/>Occupational Therapist</p>`,
  },
};

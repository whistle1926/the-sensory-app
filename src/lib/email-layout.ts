/**
 * Shared branded shell for transactional emails.
 *
 * Claire asked for "same font / size for all emails, with a branded header
 * and footer too, or logo at least" — the invoice/report/booking emails
 * each grew their own inline styling, while the form + referral emails had
 * none. This is the one place that owns the wrapper: logo header,
 * consistent typography, white card, footer with the contact address.
 *
 * Callers pass only their body content. Keep body markup simple —
 * <p>/<ul>/<strong>/<a> — and let this supply the chrome.
 *
 * Email clients ignore <style> as often as not, so everything is inline.
 */
const LOGO_URL = "https://portal.thesensorysubmarine.com/brand/logo.jpg";
const FONT = "Arial, Helvetica, sans-serif";

export interface BrandedEmailOptions {
  /** Big heading at the top of the card. Omit for a bare body. */
  heading?: string;
  /** Body HTML — already-escaped/trusted markup. */
  bodyHtml: string;
  /** Address shown in the footer. Defaults to the practice admin inbox. */
  contactEmail?: string;
  /** Extra small print under the footer (e.g. confidentiality note). */
  footerNote?: string;
}

export function brandedEmail(opts: BrandedEmailOptions): string {
  const contact = opts.contactEmail?.trim() || "admin@thesensorysubmarine.com";
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:${FONT};">
  <div style="max-width:600px;margin:0 auto;padding:24px;">

    <!-- Branded header: logo above the dark band. Absolute URL so clients
         fetch it; if remote images are blocked the band still reads. -->
    <div style="text-align:center;padding:4px 0 12px;">
      <img src="${LOGO_URL}" alt="The Sensory Submarine" width="96" height="96"
           style="display:inline-block;width:96px;height:auto;border:0;outline:none;" />
    </div>
    <div style="background:#1a1a2e;color:#ffffff;padding:22px 32px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="margin:0;font-family:${FONT};font-size:20px;font-weight:700;color:#ffffff;">The Sensory Submarine</h1>
      <p style="margin:5px 0 0;font-family:${FONT};font-size:13px;color:#ffffff;opacity:0.7;">Occupational Therapy Services</p>
    </div>

    <!-- Body card -->
    <div style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;font-family:${FONT};font-size:14px;line-height:1.6;color:#333333;">
      ${
        opts.heading
          ? `<h2 style="margin:0 0 16px;font-family:${FONT};font-size:18px;font-weight:700;color:#1a1a2e;">${opts.heading}</h2>`
          : ""
      }
      ${opts.bodyHtml}

      <hr style="border:none;border-top:1px solid #eeeeee;margin:28px 0 16px;"/>
      <p style="margin:0 0 4px;font-family:${FONT};font-size:12px;color:#999999;text-align:center;">
        The Sensory Submarine &middot; Occupational Therapy Services
      </p>
      <p style="margin:0;font-family:${FONT};font-size:11px;color:#bbbbbb;text-align:center;">
        Email us at <a href="mailto:${contact}" style="color:#999999;">${contact}</a>
      </p>
      ${
        opts.footerNote
          ? `<p style="margin:8px 0 0;font-family:${FONT};font-size:11px;color:#bbbbbb;text-align:center;">${opts.footerNote}</p>`
          : ""
      }
    </div>
  </div>
</body>
</html>`;
}

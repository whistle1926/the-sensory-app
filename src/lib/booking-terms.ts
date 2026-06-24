/**
 * Booking Terms & Conditions — single source of truth.
 *
 * Lives here (not in the DB) for two reasons:
 *  1. The text is reviewed by a person before each release; checking
 *     it into git gives us a permanent diff history.
 *  2. The Booking row stores `acceptedTermsVersion`, so as long as we
 *     bump TERMS_VERSION whenever we change the wording we always know
 *     exactly which copy each client agreed to (the version string is
 *     a discoverable git tag).
 *
 * To update: edit `TERMS_BODY_HTML`, bump `TERMS_VERSION` to today's
 * ISO date, deploy. The booking page picks up the new copy on next
 * load and new bookings are stamped with the new version.
 */

export const TERMS_VERSION = "2026-04-29";

/**
 * Services that require a non-refundable deposit to secure the slot.
 *
 * Currently empty: OT assessments are charged in full up front (no
 * partial deposit), so no deposit clause or "£100 to secure" wording is
 * shown anywhere. Add an entry here (keyed by BookingService.slug) to
 * bring deposit messaging back for a specific service.
 */
export const DEPOSIT_SERVICES: Record<string, { amountPence: number; label: string }> = {};

export interface TermsClause {
  /** Stable id used as the React key + form field name. The seeded
   * defaults use "cancellation", "deposit", "gdpr" — admin-added
   * clauses can use any short slug. */
  id: string;
  /** Short, scannable headline shown next to the checkbox. */
  heading: string;
  /** Full clause text — rendered as plain text below the heading. */
  body: string;
  /** If true, only show this clause when service is in DEPOSIT_SERVICES. */
  depositOnly?: boolean;
}

export const TERMS_CLAUSES: TermsClause[] = [
  {
    id: "cancellation",
    heading: "Cancellation policy",
    body:
      "Cancellations made within 48 hours of the appointment date incur a 50% charge. " +
      "Cancellations within 24 hours require full payment of the session fee. " +
      "These charges are waived in the case of genuine sickness — please contact us as soon as possible if you or your child are unwell.",
  },
  {
    id: "deposit",
    heading: "Deposit for new OT assessments",
    body:
      "New full OT assessments require a non-refundable deposit of £100 to secure the appointment. " +
      "This deposit is deducted from the overall balance for the assessment.",
    depositOnly: true,
  },
  {
    id: "gdpr",
    heading: "Data & confidentiality (GDPR)",
    body:
      "I consent to The Sensory Submarine collecting and securely storing my and my child's personal information " +
      "(including name, contact details, clinical notes, assessment outcomes and any documents I share) for the " +
      "purposes of providing occupational therapy services. Information is stored on encrypted systems, accessed " +
      "only by clinicians involved in care, never sold or shared with third parties without my consent, and " +
      "retained in line with HCPC and UK GDPR requirements. I may request access to, correction of, or deletion " +
      "of my records at any time by contacting the practice.",
  },
];

/** Returns the subset of clauses that should appear for a given service. */
export function clausesForService(service: string): TermsClause[] {
  const showDeposit = service in DEPOSIT_SERVICES;
  return TERMS_CLAUSES.filter((c) => !c.depositOnly || showDeposit);
}

/** Renders all applicable clauses as a tidy HTML block for the confirmation email. */
export function renderTermsHtml(service: string): string {
  const items = clausesForService(service)
    .map(
      (c) => `
        <div style="margin-bottom:16px">
          <strong style="display:block;font-size:14px;color:#0F172A;margin-bottom:4px">${escapeHtml(c.heading)}</strong>
          <span style="font-size:13px;color:#475569;line-height:1.55">${escapeHtml(c.body)}</span>
        </div>`,
    )
    .join("");
  return `
    <div style="border:1px solid #E2E8F0;border-radius:12px;padding:16px;background:#F8FAFC;margin-top:24px">
      <p style="margin:0 0 12px 0;font-size:12px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.04em">
        Terms you agreed to (v${TERMS_VERSION})
      </p>
      ${items}
    </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

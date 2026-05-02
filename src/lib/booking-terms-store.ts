/**
 * DB-backed store for the booking T&Cs.
 *
 * The legacy constants in `src/lib/booking-terms.ts` are now used as the
 * one-time seed. Every read goes through `getTermsConfig()` so admin
 * edits in /bookings → Terms apply on the next request, no redeploy.
 *
 * Lifecycle:
 *  • First call → ensureSeededTerms() inserts the default row (taken
 *    from the constants file).
 *  • Read → `clauses` is a JSON array of `TermsClause` (typed below).
 *  • Edit → admin PUT replaces `clauses` and bumps `version`.
 */
import { prisma } from "@/lib/prisma";
import {
  DEPOSIT_SERVICES,
  TERMS_CLAUSES as DEFAULT_CLAUSES,
  TERMS_VERSION as DEFAULT_VERSION,
  type TermsClause,
} from "@/lib/booking-terms";

export interface TermsConfig {
  version: string;
  clauses: TermsClause[];
}

/** Fetch + seed if missing. Returns the live editable config. */
export async function getTermsConfig(): Promise<TermsConfig> {
  let row = await prisma.bookingTermsConfig.findUnique({
    where: { id: "default" },
  });
  if (!row) {
    row = await prisma.bookingTermsConfig.create({
      data: {
        id: "default",
        version: DEFAULT_VERSION,
        clauses: DEFAULT_CLAUSES as unknown as object,
      },
    });
  }
  return {
    version: row.version,
    clauses: Array.isArray(row.clauses)
      ? (row.clauses as unknown as TermsClause[])
      : [],
  };
}

/** Subset of clauses that apply to a given service (deposit clause only
 * surfaces for services that actually require a deposit). */
export async function clausesForServiceFromDb(
  service: string,
): Promise<TermsClause[]> {
  const cfg = await getTermsConfig();
  const showDeposit = service in DEPOSIT_SERVICES;
  return cfg.clauses.filter((c) => !c.depositOnly || showDeposit);
}

/** HTML "Terms you agreed to" block for the confirmation/reminder
 * emails — rendered from the same DB rows the client saw at booking
 * time. Format kept identical to the legacy renderTermsHtml so any
 * downstream styling stays consistent. */
export async function renderTermsHtmlFromDb(service: string): Promise<string> {
  const cfg = await getTermsConfig();
  const showDeposit = service in DEPOSIT_SERVICES;
  const items = cfg.clauses
    .filter((c) => !c.depositOnly || showDeposit)
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
        Terms you agreed to (v${cfg.version})
      </p>
      ${items}
    </div>`;
}

/** Save a new version of the terms. Caller is responsible for auth. */
export async function saveTermsConfig(input: {
  version: string;
  clauses: TermsClause[];
}): Promise<TermsConfig> {
  const sanitised = sanitiseClauses(input.clauses);
  const row = await prisma.bookingTermsConfig.upsert({
    where: { id: "default" },
    update: {
      version: input.version.slice(0, 64) || new Date().toISOString().slice(0, 10),
      clauses: sanitised as unknown as object,
    },
    create: {
      id: "default",
      version: input.version.slice(0, 64) || new Date().toISOString().slice(0, 10),
      clauses: sanitised as unknown as object,
    },
  });
  return {
    version: row.version,
    clauses: row.clauses as unknown as TermsClause[],
  };
}

/** Reject malformed payloads but otherwise accept whatever the admin
 * typed — they own the wording. */
function sanitiseClauses(input: unknown): TermsClause[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw): TermsClause | null => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id.trim() : "";
      const heading = typeof r.heading === "string" ? r.heading.trim() : "";
      const body = typeof r.body === "string" ? r.body.trim() : "";
      if (!id || !heading || !body) return null;
      return {
        id: id.slice(0, 60),
        heading: heading.slice(0, 200),
        body: body.slice(0, 5_000),
        depositOnly: r.depositOnly === true,
      };
    })
    .filter((c): c is TermsClause => c !== null);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

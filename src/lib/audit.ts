/**
 * Audit-log writer.
 *
 * Records sensitive admin actions so incident response can answer
 * "who did what when" without trusting human memory. See
 * docs/incident-response.md for the runbook this supports.
 *
 * Design points:
 *   - **Best-effort.** A failure to write the audit log must never
 *     block the underlying action — at worst we log a console error
 *     and move on. The action is what matters; the audit row is
 *     observability.
 *   - **Snapshot the actor's label** at write time. If a User is
 *     later deleted (e.g. staff offboarding) the entry still reads
 *     correctly. The actor FK uses SetNull so the row survives.
 *   - **No secrets in meta.** Never pass API keys, tokens, passwords
 *     or full PII payloads through. Use descriptive identifiers
 *     (invoiceNumber, clientId, amount) — enough to investigate,
 *     not enough to misuse if the audit table is ever exfiltrated.
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

interface RecordAuditArgs {
  actorId: string | null;
  actorLabel: string;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  meta?: Record<string, unknown>;
  req?: NextRequest | Request | null;
}

/**
 * Canonical action vocabulary. Keep entries small + verb-namespaced
 * (`<resource>.<action>`) so the table is greppable.
 *
 * Adding a new action: append to this union. Anything not in the
 * union won't compile — keeps the vocabulary tight.
 */
export type AuditAction =
  | "report.delete"
  | "report.update"
  | "invoice.send"
  | "invoice.cancel"
  | "invoice.delete"
  | "client.create"
  | "client.update"
  | "client.delete"
  | "user.impersonate.start"
  | "user.impersonate.stop"
  | "settings.update";

/** Pull the client IP out of the standard proxy headers. */
function clientIp(req: RecordAuditArgs["req"]): string | null {
  if (!req) return null;
  const h = req.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  return h.get("x-real-ip");
}

/** Truncate the user-agent so we don't store war-and-peace strings. */
function ua(req: RecordAuditArgs["req"]): string | null {
  if (!req) return null;
  const v = req.headers.get("user-agent");
  return v ? v.slice(0, 240) : null;
}

export async function recordAudit({
  actorId,
  actorLabel,
  action,
  targetType,
  targetId,
  meta,
  req,
}: RecordAuditArgs): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        actorLabel: actorLabel.slice(0, 240),
        action,
        targetType: targetType.slice(0, 60),
        targetId: targetId ?? null,
        meta: (meta ?? {}) as never,
        ip: clientIp(req),
        userAgent: ua(req),
      },
    });
  } catch (err) {
    // Surface to logs but don't bubble — see top-of-file comment.
    console.error("[audit] failed to write:", action, err);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail, escapeHtml } from "@/lib/email";
import { brandedEmail } from "@/lib/email-layout";
import { isEmail } from "@/lib/forms";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

function makeToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Default wording when staff don't edit it in the Send dialog. Claire's
 * copy (2026-07-17) — the link is appended as a button by the sender, so
 * the body doesn't need to repeat {{formUrl}}. */
const DEFAULT_INVITE_BODY = `Hi,

Ahead of your upcoming OT assessment with The Sensory Submarine, please take some time to complete the referral form by following the link below:

If you've any issues or questions, please contact Claire - admin@thesensorysubmarine.com

Thank you and see you soon.

The Sensory Submarine Team`;

interface InviteRecipient {
  email: string;
  clientId?: string | null;
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
    vars[key] !== undefined ? vars[key] : `{{${key}}}`,
  );
}

function baseUrl(req: NextRequest): string {
  // Prefer env (set on Vercel). Fall back to request origin in dev.
  const env =
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!isStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { formId } = await params;
  const rows = await prisma.formInvite.findMany({
    where: { formId },
    orderBy: { sentAt: "desc" },
    select: {
      id: true,
      email: true,
      sentAt: true,
      openedAt: true,
      client: { select: { id: true, firstName: true, lastName: true } },
      submissions: {
        select: { id: true, submittedAt: true },
        orderBy: { submittedAt: "desc" },
        take: 1,
      },
    },
  });
  return NextResponse.json(rows);
}

/**
 * POST — send the form link to one or more recipients.
 * Body:
 *   {
 *     recipients: Array<{ email: string; clientId?: string }>,
 *     subject: string,      // template, supports {{formTitle}} {{formUrl}}
 *     body: string          // ditto
 *   }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!isStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { formId } = await params;
  const form = await prisma.form.findUnique({ where: { id: formId } });
  if (!form)
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  if (!form.isPublished) {
    return NextResponse.json(
      { error: "Publish the form before sending it." },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const rawRecipients = Array.isArray(body?.recipients) ? body.recipients : [];
  const subjectTemplate =
    typeof body?.subject === "string" && body.subject.trim()
      ? body.subject.trim()
      : `{{formTitle}} — please complete this short form`;
  const bodyTemplate =
    typeof body?.body === "string" && body.body.trim()
      ? body.body.trim()
      : DEFAULT_INVITE_BODY;

  // Normalise + dedupe recipients.
  const seen = new Set<string>();
  const recipients: InviteRecipient[] = [];
  for (const r of rawRecipients) {
    if (!r || typeof r !== "object") continue;
    const raw = r as { email?: unknown; clientId?: unknown };
    const email = typeof raw.email === "string" ? raw.email.trim() : "";
    if (!isEmail(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push({
      email,
      clientId:
        typeof raw.clientId === "string" && raw.clientId ? raw.clientId : null,
    });
  }

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "Add at least one valid email address." },
      { status: 400 },
    );
  }

  const origin = baseUrl(req);
  const sent: string[] = [];
  const failed: Array<{ email: string; error: string }> = [];

  for (const r of recipients) {
    const token = makeToken();
    const invite = await prisma.formInvite.create({
      data: {
        formId: form.id,
        clientId: r.clientId ?? null,
        email: r.email,
        token,
      },
    });

    const formUrl = `${origin}/f/${form.slug}?t=${token}`;
    const vars: Record<string, string> = {
      formTitle: form.title,
      formUrl,
    };
    const subject = renderTemplate(subjectTemplate, vars);
    const renderedBody = renderTemplate(bodyTemplate, vars);

    // Branded shell so form invites match the invoice/booking emails
    // (same font, logo header, footer) rather than being bare text.
    const html = brandedEmail({
      bodyHtml: `
        <div style="white-space:pre-wrap;">${escapeHtml(renderedBody)}</div>
        <p style="margin:20px 0 0;">
          <a href="${escapeHtml(formUrl)}" style="display:inline-block;background:#1a1a2e;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;">
            ${escapeHtml(form.title)}
          </a>
        </p>
        <p style="margin:18px 0 0;font-size:11px;color:#999999;">
          If the button doesn't work, copy and paste this link:<br/>
          <a href="${escapeHtml(formUrl)}" style="color:#999999;">${escapeHtml(formUrl)}</a>
        </p>`,
    });

    try {
      const res = await sendTransactionalEmail({
        to: r.email,
        subject,
        html,
      });
      if (!res.ok) {
        failed.push({ email: r.email, error: res.error ?? "send failed" });
        // Roll back the invite so we don't leave dead rows the user might re-send.
        await prisma.formInvite.delete({ where: { id: invite.id } }).catch(() => {});
        continue;
      }
      sent.push(r.email);
    } catch (err) {
      failed.push({
        email: r.email,
        error: err instanceof Error ? err.message : "unknown",
      });
      await prisma.formInvite.delete({ where: { id: invite.id } }).catch(() => {});
    }
  }

  return NextResponse.json({ sent, failed, total: recipients.length });
}

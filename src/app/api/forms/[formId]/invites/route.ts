import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail, escapeHtml } from "@/lib/email";
import { isEmail } from "@/lib/forms";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

function makeToken(): string {
  return randomBytes(18).toString("base64url");
}

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
      : `Hi,\n\nI've set up a form for you to complete when you have a moment:\n\n{{formUrl}}\n\nThanks!`;

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

    const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fb;margin:0;padding:24px">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:24px">
        <div style="white-space:pre-wrap;font-size:14px;color:#333">${escapeHtml(renderedBody)}</div>
        <div style="margin-top:24px"><a href="${escapeHtml(formUrl)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open form</a></div>
      </div>
    </body></html>`;

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

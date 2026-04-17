import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  sanitiseFormFields,
  sanitiseFormSettings,
  validateSubmission,
  extractSubmitterContact,
  type FormField,
  type SubmissionData,
  type UploadedFile,
} from "@/lib/forms";
import { sendTransactionalEmail, escapeHtml } from "@/lib/email";

// Lightweight in-memory IP rate limit — good enough for a single Vercel
// instance. Resets when the function cold-starts; if abuse becomes a real
// problem we switch to Upstash or a DB-backed sliding window.
const RECENT_HITS = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_IN_WINDOW = 5;

function rateLimit(key: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const arr = (RECENT_HITS.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_IN_WINDOW) {
    return { ok: false, retryAfter: Math.ceil((arr[0] + WINDOW_MS - now) / 1000) };
  }
  arr.push(now);
  RECENT_HITS.set(key, arr);
  return { ok: true };
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function ipFromRequest(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

function valueToHtml(value: unknown): string {
  if (value === null || value === undefined) return "<em>(blank)</em>";
  if (typeof value === "string") return escapeHtml(value).replace(/\n/g, "<br/>");
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((v) => escapeHtml(String(v))).join(", ");
  if (typeof value === "object") {
    const v = value as UploadedFile;
    if (v.url && v.filename) {
      return `<a href="${escapeHtml(v.url)}">${escapeHtml(v.filename)}</a>`;
    }
  }
  return escapeHtml(String(value));
}

function buildNotificationHtml(
  formTitle: string,
  fields: FormField[],
  clean: SubmissionData,
): string {
  const rows = fields
    .filter((f) => f.type !== "heading" && f.type !== "paragraph")
    .map((f) => {
      const label = escapeHtml(f.label || f.type);
      const value = valueToHtml(clean[f.id]);
      return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600;vertical-align:top;color:#555">${label}</td><td style="padding:6px 12px;border-bottom:1px solid #eee">${value}</td></tr>`;
    })
    .join("");

  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fb;margin:0;padding:24px">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:24px">
      <p style="margin:0 0 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#888">New submission</p>
      <h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(formTitle)}</h1>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
    </div>
  </body></html>`;
}

function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
    vars[key] !== undefined ? vars[key] : `{{${key}}}`,
  );
}

function buildAutoReplyHtml(subject: string, body: string, vars: Record<string, string>): string {
  const rendered = renderTemplate(body, vars);
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fb;margin:0;padding:24px">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:24px">
      <h1 style="margin:0 0 16px;font-size:18px">${escapeHtml(renderTemplate(subject, vars))}</h1>
      <div style="white-space:pre-wrap;font-size:14px;color:#333">${escapeHtml(rendered)}</div>
    </div>
  </body></html>`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const form = await prisma.form.findUnique({ where: { slug } });
  if (!form || !form.isPublished) {
    return NextResponse.json(
      { error: "This form is no longer accepting responses." },
      { status: 404 },
    );
  }

  // If the form requires login, reject any unauthenticated POST. The client
  // should have been gated before getting here, but this is the hard guarantee.
  const settings = sanitiseFormSettings(form.settings);
  if (settings.requireLogin) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "This form requires you to be signed in." },
        { status: 401 },
      );
    }
  }

  const ip = ipFromRequest(req);
  const rl = rateLimit(`${form.id}:${ip}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many submissions — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } },
    );
  }

  const body = await req.json().catch(() => ({}));

  // Honeypot — bots fill any field named "website" that isn't in our schema.
  if (typeof body?.website === "string" && body.website.trim() !== "") {
    // Respond 200 so bots don't adapt; but skip all work.
    return NextResponse.json({ ok: true });
  }

  const fields = sanitiseFormFields(form.fields);
  const { ok, clean, errors } = validateSubmission(fields, body?.data);
  if (!ok) {
    return NextResponse.json(
      { error: "Some fields need attention.", fieldErrors: errors },
      { status: 400 },
    );
  }

  const { submitterEmail, submitterName } = extractSubmitterContact(
    fields,
    clean,
  );

  // Associate with an invite token if one was provided.
  let inviteId: string | null = null;
  if (typeof body?.token === "string" && body.token) {
    const invite = await prisma.formInvite.findUnique({
      where: { token: body.token },
    });
    if (invite && invite.formId === form.id) inviteId = invite.id;
  }

  const submission = await prisma.formSubmission.create({
    data: {
      formId: form.id,
      inviteId,
      data: clean as unknown as object,
      fieldsSnapshot: fields as unknown as object,
      submitterEmail,
      submitterName,
      ipHash: hashIp(ip),
    },
  });

  // Email notifications — best-effort. Never roll back the DB write.
  // (`settings` is already sanitised earlier in the function.)
  const tplVars: Record<string, string> = {
    formTitle: form.title,
    submitterName: submitterName ?? "",
    submitterEmail: submitterEmail ?? "",
  };

  if (settings.notifyEmails && settings.notifyEmails.length > 0) {
    const html = buildNotificationHtml(form.title, fields, clean);
    for (const to of settings.notifyEmails) {
      try {
        await sendTransactionalEmail({
          to,
          subject: `New submission — ${form.title}`,
          html,
          replyTo: submitterEmail ?? settings.replyToEmail,
        });
      } catch (err) {
        console.error("[form-notify]", err);
      }
    }
  }

  if (
    settings.autoReply?.enabled &&
    settings.autoReply.subject &&
    settings.autoReply.body &&
    submitterEmail
  ) {
    try {
      await sendTransactionalEmail({
        to: submitterEmail,
        subject: renderTemplate(settings.autoReply.subject, tplVars),
        html: buildAutoReplyHtml(
          settings.autoReply.subject,
          settings.autoReply.body,
          tplVars,
        ),
        replyTo: settings.replyToEmail,
      });
    } catch (err) {
      console.error("[form-autoreply]", err);
    }
  }

  return NextResponse.json({
    ok: true,
    submissionId: submission.id,
    successMessage:
      settings.successMessage ?? "Thanks — we've got your response.",
  });
}

/**
 * POST /api/resources/request — a parent asks for a free download.
 *
 * The link is EMAILED rather than returned straight to the browser. That is
 * the whole mechanism: an address that receives the file is an address that
 * exists, so the list is real rather than a pile of typos and throwaways.
 *
 * Consent is separate from the download. Wanting an activity sheet is not
 * agreeing to be marketed at, and under UK GDPR the two can't be bundled —
 * so the file is sent either way, and only a ticked box records consent.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail, escapeHtml } from "@/lib/email";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const resourceId = typeof body.resourceId === "string" ? body.resourceId : "";
  const email = (typeof body.email === "string" ? body.email : "").trim().toLowerCase();
  const name = (typeof body.name === "string" ? body.name : "").trim().slice(0, 120);
  const consent = body.marketingConsent === true;
  // Bots fill everything in; a hidden field they can't see catches most.
  if (typeof body.website === "string" && body.website) {
    return NextResponse.json({ ok: true });
  }

  if (!resourceId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please give us a name and a valid email address." },
      { status: 400 },
    );
  }

  const resource = await prisma.freeResource.findFirst({
    where: { id: resourceId, isActive: true },
    select: { id: true, title: true, fileUrl: true, description: true },
  });
  if (!resource) {
    return NextResponse.json({ error: "That download isn't available." }, { status: 404 });
  }

  await prisma.resourceLead.create({
    data: {
      email,
      name,
      resourceId: resource.id,
      marketingConsent: consent,
      consentedAt: consent ? new Date() : null,
    },
  });
  await prisma.freeResource
    .update({ where: { id: resource.id }, data: { downloads: { increment: 1 } } })
    .catch(() => {});

  const settings = await prisma.emailSettings.findUnique({
    where: { id: "default" },
    select: { senderName: true },
  });
  const from = settings?.senderName || "The Sensory Submarine";

  await sendTransactionalEmail({
    to: email,
    subject: `Your download — ${resource.title}`.slice(0, 160),
    html: `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;background:#f5f6f9;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;padding:26px">
    <h1 style="margin:0 0 10px;font-size:21px;color:#1a1d26">Here's your download</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a5061">
      ${escapeHtml(name ? `${name}, thanks` : "Thanks")} for asking for
      <strong>${escapeHtml(resource.title)}</strong>. It's yours to keep, print and use as often as you like.
    </p>
    <p style="margin:0 0 22px">
      <a href="${escapeHtml(resource.fileUrl)}" style="display:inline-block;background:#2563eb;color:#fff;padding:13px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Download it</a>
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#7a8194">
      If the button doesn't work, copy this into your browser:<br>
      <span style="word-break:break-all">${escapeHtml(resource.fileUrl)}</span>
    </p>
    <p style="margin:22px 0 0;border-top:1px solid #e6e8ee;padding-top:16px;font-size:12px;line-height:1.6;color:#7a8194">
      ${escapeHtml(from)}${
        consent
          ? " — we'll let you know when there's something new. You can tell us to stop at any time by replying."
          : " — we won't email you again about anything else."
      }
    </p>
  </div>
</body></html>`,
  });

  return NextResponse.json({ ok: true });
}

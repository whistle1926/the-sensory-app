/**
 * POST /api/resources/bundle — "send me everything".
 *
 * Same bargain as a single download: the links are emailed rather than
 * handed straight to the browser, so an address that receives the bundle is
 * an address that exists. Consent stays separate from the files — under UK
 * GDPR wanting activity sheets isn't agreeing to be marketed at, so the
 * bundle goes either way and only a ticked box records consent.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail, escapeHtml } from "@/lib/email";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = (typeof body.email === "string" ? body.email : "").trim().toLowerCase();
  const name = (typeof body.name === "string" ? body.name : "").trim().slice(0, 120);
  const consent = body.marketingConsent === true;
  // Bots fill everything in; a hidden field they can't see catches most.
  if (typeof body.website === "string" && body.website) {
    return NextResponse.json({ ok: true });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please give us a valid email address." },
      { status: 400 },
    );
  }

  const resources = await prisma.freeResource.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: { id: true, title: true, description: true, fileUrl: true },
  });
  if (resources.length === 0) {
    return NextResponse.json(
      { error: "There's nothing to send just yet — check back soon." },
      { status: 404 },
    );
  }

  // A lead per sheet, so the existing per-resource reporting keeps working
  // and a bundle request counts the same as asking for each one.
  const consentedAt = consent ? new Date() : null;
  await prisma.resourceLead.createMany({
    data: resources.map((r) => ({
      email,
      name,
      resourceId: r.id,
      marketingConsent: consent,
      consentedAt,
    })),
  });
  await prisma.freeResource
    .updateMany({
      where: { id: { in: resources.map((r) => r.id) } },
      data: { downloads: { increment: 1 } },
    })
    .catch(() => {});

  const settings = await prisma.emailSettings.findUnique({
    where: { id: "default" },
    select: { senderName: true },
  });
  const from = settings?.senderName || "The Sensory Submarine";

  const rows = resources
    .map(
      (r) => `<tr><td style="padding:0 0 18px">
      <div style="font-size:16px;font-weight:600;color:#1a1d26">${escapeHtml(r.title)}</div>
      ${
        r.description
          ? `<div style="font-size:14px;line-height:1.55;color:#4a5061;margin:3px 0 8px">${escapeHtml(r.description)}</div>`
          : ""
      }
      <a href="${escapeHtml(r.fileUrl)}" style="font-size:14px;font-weight:600;color:#2563eb">Download it</a>
    </td></tr>`,
    )
    .join("");

  await sendTransactionalEmail({
    to: email,
    subject: `Your activity sheets — ${resources.length} to download`.slice(0, 160),
    html: `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;background:#f5f6f9;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;padding:26px">
    <h1 style="margin:0 0 10px;font-size:21px;color:#1a1d26">Here's the whole bundle</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#4a5061">
      ${escapeHtml(name ? `${name}, thanks` : "Thanks")} for asking. Every sheet below is
      yours to keep, print and use as often as you like.
    </p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
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

  return NextResponse.json({ ok: true, count: resources.length });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Ping endpoint the public fill page calls on mount when `?t=` is present.
 * Stamps FormInvite.openedAt the first time. Idempotent after that.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token) return NextResponse.json({ ok: true });

  const invite = await prisma.formInvite.findUnique({
    where: { token },
    include: { form: { select: { slug: true } } },
  });
  if (!invite || invite.form.slug !== slug) {
    return NextResponse.json({ ok: true }); // deliberately quiet — don't leak token validity
  }
  if (!invite.openedAt) {
    await prisma.formInvite.update({
      where: { id: invite.id },
      data: { openedAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}

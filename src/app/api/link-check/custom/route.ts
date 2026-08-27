/**
 * Links added by hand to the "Addresses in use" check — the Wix booking
 * page, socials, a partner's site. Anything the practice hands out that we
 * don't generate ourselves.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function staff() {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") return null;
  return session.user;
}

export async function POST(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 120) : "";
  let url = typeof body.url === "string" ? body.url.trim() : "";
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;

  // Only real web addresses — this list gets fetched, so a javascript: or
  // file: entry has no business in it.
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
  } catch {
    return NextResponse.json({ error: "That doesn't look like a web address." }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: "Give it a name so you know what it is." }, { status: 400 });
  }

  const last = await prisma.customLink.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
  const created = await prisma.customLink.create({
    data: {
      label,
      url: parsed.toString(),
      note: typeof body.note === "string" ? body.note.slice(0, 200) : "",
      order: (last?.order ?? -1) + 1,
    },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Which one?" }, { status: 400 });
  await prisma.customLink.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}

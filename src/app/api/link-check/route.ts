/**
 * GET /api/link-check — every public address the business hands out, and
 * whether it actually works.
 *
 * Built after a receipt went out pointing at an old domain. The addresses
 * customers are given are scattered across services, courses, resources and
 * pages, so nobody could see them in one place, let alone check them. This
 * gathers them and, on request, fetches each one.
 *
 * ?check=1 actually visits them. Without it you get the list instantly.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export interface LinkRow {
  group: string;
  label: string;
  url: string;
  /** Why it matters, when that isn't obvious from the label. */
  note?: string;
  status?: number;
  ok?: boolean;
}

function base(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  return raw.replace(/\/$/, "") || "https://portal.thesensorysubmarine.com";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const site = base();
  const rows: LinkRow[] = [];

  rows.push({
    group: "The basics",
    label: "Portal / admin",
    url: site,
    note: "Also the address used in customer emails.",
  });
  rows.push({
    group: "The basics",
    label: "Booking front door",
    url: "https://book.thesensorysubmarine.com",
    note: "The short address to give parents.",
  });
  rows.push({ group: "The basics", label: "All bookable services", url: `${site}/book` });

  const services = await prisma.bookingService.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: { title: true, slug: true },
  });
  for (const s of services) {
    rows.push({ group: "Booking links", label: s.title, url: `${site}/book/${s.slug}` });
  }

  const courses = await prisma.course.findMany({
    where: { isLive: true, status: "AVAILABLE" },
    orderBy: { title: "asc" },
    select: { title: true, slug: true },
  });
  for (const c of courses) {
    rows.push({ group: "Courses on sale", label: c.title, url: `${site}/courses/${c.slug}` });
    rows.push({
      group: "Courses on sale",
      label: `${c.title} — checkout`,
      url: `${site}/courses/${c.slug}/checkout`,
    });
  }

  const freeCount = await prisma.freeResource.count({ where: { isActive: true } });
  rows.push({
    group: "Other public pages",
    label: "Free resources",
    url: `${site}/resources`,
    note: freeCount === 0 ? "Nothing on it yet." : `${freeCount} download${freeCount === 1 ? "" : "s"}.`,
  });

  const pages = await prisma.page
    .findMany({ where: { isPublished: true }, select: { title: true, slug: true } })
    .catch(() => []);
  for (const p of pages) {
    rows.push({ group: "Other public pages", label: p.title, url: `${site}/${p.slug}` });
  }

  if (new URL(req.url).searchParams.get("check") !== "1") {
    return NextResponse.json({ site, rows });
  }

  // Visit each one. A page that redirects to sign-in is still "reachable",
  // which is why the code is shown rather than a bare tick.
  const checked = await Promise.all(
    rows.map(async (r) => {
      try {
        const res = await fetch(r.url, { redirect: "manual", cache: "no-store" });
        return { ...r, status: res.status, ok: res.status < 400 };
      } catch {
        return { ...r, status: 0, ok: false };
      }
    }),
  );

  return NextResponse.json({ site, rows: checked });
}

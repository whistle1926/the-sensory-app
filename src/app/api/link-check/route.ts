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
  /** Plain English. Nobody should have to know what 200 means. */
  verdict?: string;
  /** Present only on links added by hand, so they can be removed. */
  id?: string;
}

/** What a response code actually means for the person reading it. */
function verdictFor(status: number): { verdict: string; ok: boolean } {
  if (status === 0) return { verdict: "No answer", ok: false };
  if (status === 200) return { verdict: "Working", ok: true };
  if (status >= 300 && status < 400) return { verdict: "Sends you elsewhere", ok: true };
  if (status === 401 || status === 403) return { verdict: "Asks you to sign in", ok: true };
  if (status === 404) return { verdict: "Page missing", ok: false };
  if (status >= 500) return { verdict: "Site is erroring", ok: false };
  return { verdict: `Unexpected (${status})`, ok: false };
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

  // The Wix sites aren't ours to change, but they're where most parents
  // actually start — a broken link there matters more than one in here.
  rows.push({
    group: "Main websites (Wix / partners)",
    label: "The Sensory Submarine",
    url: "https://www.thesensorysubmarine.com",
    note: "The main site parents find first.",
  });
  rows.push({
    group: "Main websites (Wix / partners)",
    label: "The Little Sensory Explorers",
    url: "https://www.thelittlesensoryexplorers.co.uk",
    note: "Partnership — sensory play course.",
  });
  rows.push({
    group: "Main websites (Wix / partners)",
    label: "Sensory Eaters Programme",
    url: "https://sensoryeaters.thinkific.com",
    note: "Partnership — hosted on Thinkific, not by us.",
  });

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

  const custom = await prisma.customLink.findMany({ orderBy: { order: "asc" } });
  for (const c of custom) {
    rows.push({
      group: "Added by you",
      label: c.label,
      url: c.url,
      note: c.note || undefined,
      id: c.id,
    });
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
        return { ...r, status: res.status, ...verdictFor(res.status) };
      } catch {
        return { ...r, status: 0, ...verdictFor(0) };
      }
    }),
  );

  return NextResponse.json({ site, rows: checked });
}

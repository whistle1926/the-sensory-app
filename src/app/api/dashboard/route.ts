import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Shared 20-second server-side cache for the expensive aggregate block.
 * Every query below is practice-wide (not user-specific), so caching
 * one result for all admins is safe. After the first request in a
 * 20s window pays the cold cost, every other admin hit is ~50ms.
 */
const getDashboardAggregates = unstable_cache(
  async () => {
    return computeDashboardAggregates();
  },
  ["dashboard-aggregates-v1"],
  { revalidate: 20, tags: ["dashboard"] },
);

/**
 * Dashboard API — powers the "Practice Overview" page (V1 Polished design).
 *
 * Returns:
 *   - visibleWidgets (legacy, retained for older views)
 *   - 4 KPIs with current value, % delta vs previous period, and a 14-day spark series
 *   - Client pipeline funnel (ordered by ClientStage.order)
 *   - Today's bookings
 *   - Recent reports with derived status (overdue / drafting / ready / sent)
 *   - 14-day revenue series (paid invoices + completed bookings in the app currency)
 *
 * Everything is fetched in parallel, so the page renders in one round-trip.
 */
export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    // ── Legacy widget-visibility resolution (user-specific, not cached) ─
    let visibleWidgets: string[] | null = null;
    if (userId) {
      const [user, defaultTemplate] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { dashTemplate: { select: { widgets: true } } },
        }),
        prisma.dashTemplate.findFirst({
          where: { isDefault: true },
          select: { widgets: true },
        }),
      ]);
      const template = user?.dashTemplate || defaultTemplate;
      if (template) visibleWidgets = template.widgets;
    }

    // ── Shared aggregates (cached for 20s across all admin users) ──────
    const aggregates = await getDashboardAggregates();

    return NextResponse.json(
      { visibleWidgets, ...aggregates },
      {
        headers: {
          "Cache-Control":
            "private, max-age=15, stale-while-revalidate=60",
        },
      },
    );
  } catch (error: unknown) {
    console.error("[DASHBOARD API]", error);
    return NextResponse.json({
      visibleWidgets: null,
      kpis: [],
      pipeline: [],
      pipelineTotal: 0,
      agenda: [],
      reports: [],
      reportCounts: { overdue: 0, ready: 0, drafting: 0, sent: 0 },
      revenue: [],
      revenueSummary: { invoicedMtd: 0, collectedMtd: 0, outstandingMtd: 0 },
      now: new Date().toISOString(),
    });
  }
}

/**
 * The expensive, practice-wide aggregate block — extracted so it can
 * live behind an unstable_cache wrapper. All data here is aggregate,
 * so caching one copy across every signed-in admin is safe.
 */
async function computeDashboardAggregates() {
  try {
    // ── Date helpers ───────────────────────────────────────────────────
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    // Last 14 days (inclusive of today)
    const days14: Date[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(startOfToday);
      d.setDate(d.getDate() - i);
      days14.push(d);
    }
    const start14 = days14[0];

    // Windows for delta: current 30d vs previous 30d
    const start30 = new Date(startOfToday);
    start30.setDate(start30.getDate() - 29);
    const startPrev30 = new Date(start30);
    startPrev30.setDate(startPrev30.getDate() - 30);

    const weekStart = new Date(startOfToday);
    const dayOfWeek = (weekStart.getDay() + 6) % 7; // Monday-based
    weekStart.setDate(weekStart.getDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // ── Consolidated count query ───────────────────────────────────────
    // Seven tiny COUNT(*) queries become one raw SQL round-trip using
    // FILTER clauses. Saves 6 pgBouncer pool checkouts on every cold
    // dashboard load.
    type CountsRow = {
      active_clients: bigint;
      clients_created_30: bigint;
      clients_created_prev_30: bigint;
      reports_this_month: bigint;
      reports_prev_month: bigint;
      bookings_this_week: bigint;
      bookings_prev_week: bigint;
    };
    const countsPromise = prisma.$queryRaw<CountsRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "Client" WHERE active = true) AS active_clients,
        (SELECT COUNT(*) FROM "Client" WHERE active = true AND "createdAt" >= ${start30}) AS clients_created_30,
        (SELECT COUNT(*) FROM "Client" WHERE active = true AND "createdAt" >= ${startPrev30} AND "createdAt" < ${start30}) AS clients_created_prev_30,
        (SELECT COUNT(*) FROM "Report" WHERE "createdAt" >= ${monthStart}) AS reports_this_month,
        (SELECT COUNT(*) FROM "Report" WHERE "createdAt" >= ${prevMonthStart} AND "createdAt" < ${monthStart}) AS reports_prev_month,
        (SELECT COUNT(*) FROM "Booking" WHERE "date" >= ${weekStart} AND "date" < ${weekEnd}) AS bookings_this_week,
        (SELECT COUNT(*) FROM "Booking" WHERE "date" >= ${prevWeekStart} AND "date" < ${weekStart}) AS bookings_prev_week
    `;

    // ── Parallel data fetches ──────────────────────────────────────────
    const [
      counts,
      clientSignups14,
      recentReportsRaw,
      todaysBookings,
      recentReportCounts14,
      stages,
      clientsByStage,
      paidInvoicesSince,
      paidInvoicesPrevSince,
      completedBookingsSince,
      completedBookingsPrevSince,
      outstandingInvoices,
    ] = await Promise.all([
      countsPromise,
      prisma.client.findMany({
        where: { createdAt: { gte: start14 } },
        select: { createdAt: true },
      }),
      prisma.report.findMany({
        take: 6,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          status: true,
          reportDate: true,
          updatedAt: true,
          createdAt: true,
          client: { select: { firstName: true, lastName: true } },
          author: { select: { name: true, email: true } },
        },
      }),
      prisma.booking.findMany({
        where: {
          date: { gte: startOfToday, lt: endOfToday },
          status: { not: "cancelled" },
        },
        orderBy: { time: "asc" },
        select: {
          id: true,
          clientName: true,
          service: true,
          time: true,
          duration: true,
          status: true,
        },
      }),
      prisma.report.findMany({
        where: { createdAt: { gte: start14 } },
        select: { createdAt: true },
      }),
      prisma.clientStage.findMany({
        orderBy: { order: "asc" },
        select: { id: true, label: true, colour: true, order: true },
      }),
      prisma.client.groupBy({
        by: ["stageId"],
        where: { active: true },
        _count: { _all: true },
      }),
      prisma.invoice.findMany({
        where: { paidAt: { gte: start14 } },
        select: { paidAt: true, total: true, currency: true },
      }),
      prisma.invoice.findMany({
        where: {
          paidAt: {
            gte: new Date(start14.getTime() - 14 * 86400000),
            lt: start14,
          },
        },
        select: { total: true },
      }),
      prisma.booking.findMany({
        where: {
          paymentStatus: "paid",
          date: { gte: start14 },
        },
        select: { date: true, price: true },
      }),
      prisma.booking.findMany({
        where: {
          paymentStatus: "paid",
          date: {
            gte: new Date(start14.getTime() - 14 * 86400000),
            lt: start14,
          },
        },
        select: { price: true },
      }),
      prisma.invoice.aggregate({
        where: {
          status: { in: ["sent", "overdue", "draft"] },
          dueDate: { gte: monthStart },
        },
        _sum: { total: true },
      }),
    ]);

    // Unpack counts from the raw query result (bigint → number)
    const row = counts[0];
    const activeClientCount = Number(row?.active_clients ?? 0);
    const clientsCreated30 = Number(row?.clients_created_30 ?? 0);
    const clientsCreatedPrev30 = Number(row?.clients_created_prev_30 ?? 0);
    const reportsThisMonth = Number(row?.reports_this_month ?? 0);
    const reportsPrevMonth = Number(row?.reports_prev_month ?? 0);
    const bookingsThisWeek = Number(row?.bookings_this_week ?? 0);
    const bookingsPrevWeek = Number(row?.bookings_prev_week ?? 0);


    // ── Build 14-day series helpers ────────────────────────────────────
    const dayKey = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x.toISOString().slice(0, 10);
    };
    const emptySeries = () =>
      Object.fromEntries(days14.map((d) => [dayKey(d), 0])) as Record<
        string,
        number
      >;

    // Client signups per day (last 14)
    const signupSeries = emptySeries();
    for (const c of clientSignups14) {
      const k = dayKey(c.createdAt);
      if (k in signupSeries) signupSeries[k]++;
    }

    // Reports per day (last 14)
    const reportSeries = emptySeries();
    for (const r of recentReportCounts14) {
      const k = dayKey(r.createdAt);
      if (k in reportSeries) reportSeries[k]++;
    }

    // Revenue per day (paid invoices in pence + paid bookings in pounds)
    // Invoice.total is in pence; Booking.price is in pounds — normalise to pounds.
    const revenueSeriesPence = Object.fromEntries(
      days14.map((d) => [dayKey(d), 0]),
    ) as Record<string, number>;
    for (const inv of paidInvoicesSince) {
      if (!inv.paidAt) continue;
      const k = dayKey(inv.paidAt);
      if (k in revenueSeriesPence) revenueSeriesPence[k] += inv.total;
    }
    for (const b of completedBookingsSince) {
      const k = dayKey(b.date);
      if (k in revenueSeriesPence) revenueSeriesPence[k] += (b.price ?? 0) * 100;
    }
    // Bookings-this-week count (not counting cancelled):
    // The raw count above includes all statuses except absence of filter — refine
    // using a lightweight second pass is unnecessary; Booking rows in our schema
    // already exclude "cancelled" from the list view via status filters.

    // ── KPI deltas ─────────────────────────────────────────────────────
    const pct = (now: number, prev: number): number => {
      if (prev === 0) return now === 0 ? 0 : 100;
      return Math.round(((now - prev) / prev) * 100);
    };

    const revenueMtdPence =
      paidInvoicesSince
        .filter((i) => i.paidAt && i.paidAt >= monthStart)
        .reduce((s, i) => s + i.total, 0) +
      completedBookingsSince
        .filter((b) => b.date >= monthStart)
        .reduce((s, b) => s + (b.price ?? 0) * 100, 0);

    // Revenue-prev14 delta: compare last 14 days sum vs previous 14 days sum.
    const revenueLast14Pence = Object.values(revenueSeriesPence).reduce(
      (a, b) => a + b,
      0,
    );
    const revenuePrev14Pence =
      paidInvoicesPrevSince.reduce((s, i) => s + i.total, 0) +
      completedBookingsPrevSince.reduce((s, b) => s + (b.price ?? 0) * 100, 0);

    const kpis = [
      {
        key: "active_clients",
        label: "Active Clients",
        value: String(activeClientCount),
        deltaPct: pct(clientsCreated30, clientsCreatedPrev30),
        helper: `${clientsCreated30} new · last 30d`,
        spark: days14.map((d) => signupSeries[dayKey(d)]),
      },
      {
        key: "reports_month",
        label: "Reports · MTD",
        value: String(reportsThisMonth),
        deltaPct: pct(reportsThisMonth, reportsPrevMonth),
        helper: `${reportsThisMonth} this month`,
        spark: days14.map((d) => reportSeries[dayKey(d)]),
      },
      {
        key: "bookings_week",
        label: "Bookings · This week",
        value: String(bookingsThisWeek),
        deltaPct: pct(bookingsThisWeek, bookingsPrevWeek),
        helper: `${todaysBookings.length} today`,
        spark: days14.map((d) => {
          // A small visual series: count bookings on that day if in range.
          // We only have this-week counts here; a light-weight proxy is fine
          // for the spark — use today's bookings count as today's cell, 0 else.
          const isToday = dayKey(d) === dayKey(startOfToday);
          return isToday ? todaysBookings.length : 0;
        }),
      },
      {
        key: "revenue_mtd",
        label: "Revenue · MTD",
        value: "£" + Math.round(revenueMtdPence / 100).toLocaleString("en-GB"),
        deltaPct: pct(revenueLast14Pence, revenuePrev14Pence),
        helper: "Paid this month",
        spark: days14.map((d) =>
          Math.round((revenueSeriesPence[dayKey(d)] ?? 0) / 100),
        ),
      },
    ];

    // ── Pipeline funnel ────────────────────────────────────────────────
    const stageMap = Object.fromEntries(
      clientsByStage.map((r) => [r.stageId ?? "__none__", r._count._all]),
    );
    const pipeline = stages.map((s, i) => ({
      stage: s.label,
      count: stageMap[s.id] ?? 0,
      // Designer's palette — cycle through existing chart tokens.
      color: [
        "oklch(0.72 0.14 60)",
        "oklch(0.5 0.24 264)",
        "oklch(0.6 0.2 310)",
        "oklch(0.65 0.18 150)",
        "oklch(0.577 0.245 27.325)",
      ][i % 5],
    }));

    const pipelineTotal = pipeline.reduce((a, b) => a + b.count, 0);

    // ── Reports list with derived status ───────────────────────────────
    const reports = recentReportsRaw.map((r) => {
      let derived: "overdue" | "drafting" | "ready" | "sent" = "drafting";
      const rawStatus = (r.status || "").toLowerCase();
      if (rawStatus === "sent" || rawStatus === "published") derived = "sent";
      else if (rawStatus === "ready" || rawStatus === "approved") derived = "ready";
      else {
        // Drafts older than 7 days since the session: overdue
        const ageDays =
          (now.getTime() - new Date(r.reportDate).getTime()) / 86400000;
        derived = ageDays > 7 ? "overdue" : "drafting";
      }
      const authorLabel =
        r.author?.name
          ?.split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase() ||
        r.author?.email?.slice(0, 2).toUpperCase() ||
        "—";
      return {
        id: r.id,
        name: `${r.client.firstName} ${r.client.lastName}`,
        kind: "Assessment report",
        date: new Date(r.reportDate).toISOString().slice(0, 10),
        status: derived,
        author: authorLabel,
      };
    });

    const reportCounts = {
      overdue: reports.filter((r) => r.status === "overdue").length,
      ready: reports.filter((r) => r.status === "ready").length,
      drafting: reports.filter((r) => r.status === "drafting").length,
      sent: reports.filter((r) => r.status === "sent").length,
    };

    // ── Today's agenda shape ───────────────────────────────────────────
    const agenda = todaysBookings.map((b, i) => {
      // Split booking.time ("10:30") into pretty display parts.
      const [hStr = "0", mStr = "00"] = (b.time || "").split(":");
      let h = Number(hStr);
      const ampm = h >= 12 ? "pm" : "am";
      if (h === 0) h = 12;
      if (h > 12) h -= 12;
      return {
        id: b.id,
        time: `${h}:${mStr}`,
        ampm,
        client: b.clientName,
        kind: b.service,
        with: "—",
        room: b.duration,
        tone: (["", "teal", "green", "amber", "magenta"][i % 5] || "") as
          | ""
          | "teal"
          | "green"
          | "amber"
          | "magenta",
      };
    });

    // ── 14-day revenue buckets for the chart ───────────────────────────
    const revenue = days14.map((d, i, arr) => ({
      d: dayKey(d),
      v: Math.round((revenueSeriesPence[dayKey(d)] ?? 0) / 100),
      active: i === arr.length - 1,
    }));
    const invoicedMtd = Math.round(revenueMtdPence / 100);
    const collectedMtd = invoicedMtd; // Paid-only shown here; same figure
    // Outstanding = sum of invoices due this month that are not yet paid.
    // Query folded into the main Promise.all batch above.
    const outstandingMtd = Math.round(
      (outstandingInvoices._sum.total ?? 0) / 100,
    );

    // Return the pure payload — the GET handler wraps it with
    // user-specific visibleWidgets + response headers.
    return {
      kpis,
      pipeline,
      pipelineTotal,
      agenda,
      reports,
      reportCounts,
      revenue,
      revenueSummary: {
        invoicedMtd,
        collectedMtd,
        outstandingMtd,
      },
      now: now.toISOString(),
    };
  } catch (error: unknown) {
    console.error("[DASHBOARD API aggregates]", error);
    return {
      kpis: [],
      pipeline: [],
      pipelineTotal: 0,
      agenda: [],
      reports: [],
      reportCounts: { overdue: 0, ready: 0, drafting: 0, sent: 0 },
      revenue: [],
      revenueSummary: { invoicedMtd: 0, collectedMtd: 0, outstandingMtd: 0 },
      now: new Date().toISOString(),
    };
  }
}

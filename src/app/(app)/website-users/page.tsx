import { redirect } from "next/navigation";
import { GraduationCap, Mail } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Toolbar, Panel, Chip } from "@/components/ds";

export const dynamic = "force-dynamic";

/**
 * Website Users — admin view of CLIENT-role users (parents / learners who
 * land via the public site, buy courses, run home programmes, etc.).
 *
 * This is intentionally separate from /clients (which is the OT case-load
 * of children + diagnoses + therapy stages). A "website user" is a User
 * record with role=CLIENT; an OT "client" is a Client record (a child).
 *
 * Server component — single Prisma query with eager-loaded enrollment +
 * paid-purchase aggregates so the table can render without a round-trip.
 * Plain Tailwind classes on the CTA Link (no buttonVariants — that's a
 * client-only export and crashes server components).
 */
export default async function WebsiteUsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "CLIENT") redirect("/portal");

  const users = await prisma.user.findMany({
    where: { role: "CLIENT" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      enrollments: {
        select: {
          id: true,
          enrolledAt: true,
          course: { select: { title: true, price: true } },
        },
      },
      coursePurchases: {
        where: { paymentStatus: "paid" },
        select: { amount: true, completedAt: true },
      },
    },
  });

  // ── Derive per-user summary stats + KPIs ─────────────────────────────
  type Row = (typeof users)[number] & {
    enrollmentCount: number;
    paidCount: number;
    totalPaid: number;
    lastActivity: Date | null;
    isPaid: boolean;
  };
  const rows: Row[] = users.map((u) => {
    const totalPaid = u.coursePurchases.reduce((s, p) => s + p.amount, 0);
    const lastEnrolment = u.enrollments
      .map((e) => e.enrolledAt)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const lastPurchase = u.coursePurchases
      .map((p) => p.completedAt)
      .filter((d): d is Date => Boolean(d))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const lastActivity = [lastEnrolment, lastPurchase, u.createdAt]
      .filter((d): d is Date => Boolean(d))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return {
      ...u,
      enrollmentCount: u.enrollments.length,
      paidCount: u.coursePurchases.length,
      totalPaid,
      lastActivity: lastActivity ?? null,
      isPaid: u.coursePurchases.length > 0,
    };
  });

  const total = rows.length;
  const paidCount = rows.filter((r) => r.isPaid).length;
  const freeCount = total - paidCount;
  const enrolledCount = rows.filter((r) => r.enrollmentCount > 0).length;
  const totalRevenue = rows.reduce((s, r) => s + r.totalPaid, 0);

  return (
    <div className="space-y-6">
      <Toolbar
        title="Website Users"
        subtitle="People who signed up via the public site — course buyers, free learners, programme parents."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <KpiCard label="Total" value={total.toString()} hint={`${enrolledCount} with at least one enrolment`} />
        <KpiCard label="Paid" value={paidCount.toString()} hint={`£${totalRevenue} total course revenue`} />
        <KpiCard label="Free" value={freeCount.toString()} hint="No purchases yet" />
        <KpiCard label="Enrolled" value={enrolledCount.toString()} hint="At least one course in progress" />
      </div>

      <Panel title="All website users" subtitle={`${total} total`}>
        {total === 0 ? (
          <div className="ds-empty">
            <GraduationCap className="mx-auto h-8 w-8" style={{ color: "var(--muted-foreground)", opacity: 0.5 }} />
            <p style={{ marginTop: 10, fontWeight: 600 }}>No website users yet</p>
            <p style={{ marginTop: 4, fontSize: 12 }}>
              They&apos;ll appear here as soon as someone signs up via /courses or a free programme.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Courses</th>
                  <th className="px-5 py-3 font-medium">Spent</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="transition hover:bg-muted/20">
                    <td className="px-5 py-3 font-semibold">{r.name}</td>
                    <td className="px-5 py-3">
                      <a
                        href={`mailto:${r.email}`}
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Mail className="h-3 w-3" />
                        {r.email}
                      </a>
                    </td>
                    <td className="px-5 py-3">
                      {r.isPaid ? (
                        <Chip tone="success">Paid</Chip>
                      ) : r.enrollmentCount > 0 ? (
                        <Chip tone="info">Free</Chip>
                      ) : (
                        <Chip tone="neutral">No activity</Chip>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {r.enrollmentCount === 0
                        ? "—"
                        : `${r.enrollmentCount} enrolment${r.enrollmentCount === 1 ? "" : "s"}`}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {r.totalPaid > 0 ? `£${r.totalPaid}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {r.createdAt.toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {r.lastActivity ? relTime(r.lastActivity) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diff / day);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { canAccessClient } from "@/lib/auth-guard";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  GraduationCap,
  Home,
  Plus,
  Target,
} from "lucide-react";
import Link from "next/link";
import { ClientProfileEditor } from "@/components/clients/client-profile-editor";
import { ViewAsButton } from "@/components/impersonate/view-as-button";
import { ProgressNotesSection } from "@/components/clients/progress-notes-section";
import { GoalsSection } from "@/components/clients/goals-section";
import { Toolbar, Panel, Chip, Empty } from "@/components/ds";

/**
 * Client detail — admin view.
 *
 * Toolbar header with back-link + primary CTA. Everything below sits inside
 * Panels so the visual language matches the rest of the admin surface.
 */
export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { clientId } = await params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      reports: {
        include: { session: true },
        orderBy: { reportDate: "desc" },
      },
      // Referral / assessment forms attached to this client (parent
      // questionnaire, SPM, custom intakes…).
      intakeItems: {
        orderBy: { createdAt: "desc" },
      },
      // Forms built in /forms and sent to this client. Latest
      // submission per invite is enough for the row preview.
      formInvites: {
        include: {
          form: { select: { id: true, title: true, slug: true } },
          submissions: {
            orderBy: { submittedAt: "desc" },
            take: 1,
            select: { id: true, submittedAt: true },
          },
        },
        orderBy: { sentAt: "desc" },
      },
      // Used by the Overview card to show goal count.
      goals: { select: { id: true } },
      parent: {
        include: {
          setupTokens: {
            where: { usedAt: null, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          enrollments: {
            include: {
              course: { select: { id: true, title: true } },
              moduleProgress: { select: { status: true } },
            },
            orderBy: { enrolledAt: "desc" },
          },
        },
      },
    },
  });

  if (!client) notFound();
  if (!canAccessClient(session.user.role, session.user.id, client))
    redirect("/dashboard");

  const adminCanEdit = session.user.role !== "CLIENT";
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const parent = client.parent;
  const hasPendingSetup = !!parent && parent.setupTokens.length > 0;

  // ─── Overview stats ──────────────────────────────────────────────
  // "Where are we with this client?" — what's done, what's pending.
  const intakeTotal = client.intakeItems.length;
  const intakeDone = client.intakeItems.filter(
    (i) => i.status === "completed",
  ).length;
  const formsSent = client.formInvites.length;
  const formsSubmitted = client.formInvites.filter(
    (i) => i.submissions.length > 0,
  ).length;
  const reportCount = client.reports.length;
  const goalCount = client.goals.length;

  // Home programme lives in the latest report's content blob (no
  // separate per-client programme record exists yet — see
  // src/app/(app)/programmes/page.tsx). We surface the most recent
  // report that actually has suggestions, not just the latest report.
  const reportWithProgramme = client.reports.find((r) => {
    const c = r.content as { homeProgrammeSuggestions?: string } | null;
    return !!c?.homeProgrammeSuggestions?.trim();
  });
  const homeProgrammeText =
    (reportWithProgramme?.content as { homeProgrammeSuggestions?: string } | null)
      ?.homeProgrammeSuggestions?.trim() ?? "";

  // ─── Unified "Forms & assessments" feed ─────────────────────────
  // Intake items + form invites in a single list, newest first, so
  // Patrick can scan a single timeline rather than two separate ones.
  type FeedRow = {
    id: string;
    kind: "intake" | "form";
    label: string;
    status: "completed" | "submitted" | "sent" | "opened" | "pending";
    when: Date;
    href?: string;
  };
  const feed: FeedRow[] = [
    ...client.intakeItems.map<FeedRow>((i) => ({
      id: `intake-${i.id}`,
      kind: "intake",
      label: i.label,
      status: i.status === "completed" ? "completed" : i.status === "sent" ? "sent" : "pending",
      when: i.completedAt ?? i.sentAt ?? i.createdAt,
      href: i.fileUrl || i.url || undefined,
    })),
    ...client.formInvites.map<FeedRow>((inv) => {
      const submitted = inv.submissions[0];
      return {
        id: `form-${inv.id}`,
        kind: "form",
        label: inv.form.title,
        status: submitted ? "submitted" : inv.openedAt ? "opened" : "sent",
        when: submitted?.submittedAt ?? inv.openedAt ?? inv.sentAt,
        href: `/forms/${inv.form.id}`,
      };
    }),
  ].sort((a, b) => b.when.getTime() - a.when.getTime());

  return (
    <div className="space-y-6">
      <Link
        href="/clients"
        className="ds-link inline-flex items-center"
        style={{ fontWeight: 500 }}
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        Back to clients
      </Link>

      <Toolbar
        title={`${client.firstName} ${client.lastName}`}
        subtitle={`DOB ${new Date(client.dateOfBirth).toLocaleDateString("en-GB")}${
          client.diagnosis ? ` · ${client.diagnosis}` : ""
        }`}
        actions={
          adminCanEdit && (
            <Link
              href={`/reports/new?clientId=${client.id}`}
              className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Report
            </Link>
          )
        }
      />

      {/* ─── Overview — quick status across the case ─────────────── */}
      {adminCanEdit && (
        <Panel
          title={`Where we are with ${client.firstName}`}
          subtitle="A snapshot of completed and pending work"
          padded
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <OverviewCell
              icon={<ClipboardList className="h-4 w-4" />}
              label="Intake forms"
              valueTone={
                intakeTotal === 0
                  ? "neutral"
                  : intakeDone === intakeTotal
                    ? "success"
                    : "warn"
              }
              value={
                intakeTotal === 0
                  ? "None yet"
                  : `${intakeDone} of ${intakeTotal} complete`
              }
            />
            <OverviewCell
              icon={<FileText className="h-4 w-4" />}
              label="Forms sent"
              valueTone={
                formsSent === 0
                  ? "neutral"
                  : formsSubmitted === formsSent
                    ? "success"
                    : "warn"
              }
              value={
                formsSent === 0
                  ? "None yet"
                  : `${formsSubmitted} of ${formsSent} submitted`
              }
            />
            <OverviewCell
              icon={<FileText className="h-4 w-4" />}
              label="Reports"
              valueTone={reportCount > 0 ? "success" : "neutral"}
              value={
                reportCount === 0
                  ? "None yet"
                  : `${reportCount} on file`
              }
            />
            <OverviewCell
              icon={<Home className="h-4 w-4" />}
              label="Home programme"
              valueTone={homeProgrammeText ? "success" : "neutral"}
              value={homeProgrammeText ? "On file" : "Not yet"}
            />
            <OverviewCell
              icon={<Target className="h-4 w-4" />}
              label="Goals"
              valueTone={goalCount > 0 ? "success" : "neutral"}
              value={goalCount === 0 ? "None yet" : `${goalCount} set`}
            />
          </div>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {adminCanEdit ? (
          <ClientProfileEditor
            client={{
              id: client.id,
              firstName: client.firstName,
              lastName: client.lastName,
              dateOfBirth: client.dateOfBirth.toISOString().slice(0, 10),
              diagnosis: client.diagnosis || "",
              presentingConcerns: client.presentingConcerns || "",
              referrer: client.referrer || "",
              parentCarerName: client.parentCarerName || "",
              parentCarerEmail: client.parentCarerEmail || "",
              currency: client.currency || "GBP",
            }}
          />
        ) : (
          <Panel title="Client information" padded>
            <div className="space-y-2 text-sm">
              {client.diagnosis && (
                <div>
                  <span className="font-medium">Diagnosis:</span>{" "}
                  {client.diagnosis}
                </div>
              )}
              {client.presentingConcerns && (
                <div>
                  <span className="font-medium">Presenting Concerns:</span>{" "}
                  {client.presentingConcerns}
                </div>
              )}
              {client.referrer && (
                <div>
                  <span className="font-medium">Referrer:</span> {client.referrer}
                </div>
              )}
            </div>
          </Panel>
        )}

        {adminCanEdit && (
          <Panel title="Parent account" padded>
            {parent ? (
              <div className="space-y-4 text-sm">
                <div className="space-y-2">
                  <div>
                    <span className="font-medium">Name:</span> {parent.name}
                  </div>
                  <div>
                    <span className="font-medium">Email:</span>{" "}
                    <a
                      href={`mailto:${parent.email}`}
                      className="text-primary hover:underline"
                    >
                      {parent.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasPendingSetup ? (
                      <>
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <span className="text-amber-700 dark:text-amber-400">
                          Password setup link pending
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-green-700 dark:text-green-400">
                          Password set · can log in
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {isSuperAdmin && (
                  <div className="border-t border-border pt-4">
                    <p className="mb-2 text-xs text-muted-foreground">
                      Preview what the parent sees when they log in.
                    </p>
                    <ViewAsButton
                      targetUserId={parent.id}
                      targetLabel={parent.name.split(" ")[0] || "parent"}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    No parent account linked
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add a Parent/Carer email in the client details above to create
                  a linked account automatically.
                </p>
              </div>
            )}
          </Panel>
        )}
      </div>

      {adminCanEdit && parent && parent.enrollments.length > 0 && (
        <Panel
          title={
            <span className="inline-flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" />
              Training
            </span>
          }
          subtitle={`${parent.enrollments.length} enrolment${parent.enrollments.length === 1 ? "" : "s"}`}
        >
          <div className="divide-y divide-border">
            {parent.enrollments.map((enrol) => {
              const total = enrol.moduleProgress.length;
              const done = enrol.moduleProgress.filter(
                (p) => p.status === "COMPLETED",
              ).length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const isComplete = enrol.status === "COMPLETED";
              const enrolledOn = new Date(enrol.enrolledAt).toLocaleDateString(
                "en-GB",
              );
              return (
                <div key={enrol.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {enrol.course.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Enrolled {enrolledOn} · {done} of {total} modules complete
                      </p>
                    </div>
                    <Chip tone={isComplete ? "success" : "info"}>
                      {isComplete ? "Completed" : "In progress"}
                    </Chip>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground ds-tabular">
                      {pct}%
                    </span>
                  </div>
                  {isSuperAdmin && (
                    <div className="mt-3">
                      <ViewAsButton
                        targetUserId={parent.id}
                        targetLabel={parent.name.split(" ")[0] || "parent"}
                        returnPath={`/portal/training/${enrol.course.id}`}
                        label="Open this course as parent"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel
        title="Reports"
        subtitle={`${client.reports.length} report${client.reports.length === 1 ? "" : "s"} on file`}
      >
        {client.reports.length === 0 ? (
          <Empty>No reports yet.</Empty>
        ) : (
          <div className="divide-y divide-border">
            {client.reports.map((report) => (
              <Link
                key={report.id}
                href={`/reports/${report.id}`}
                className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-muted/20"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground/60" />
                  <div>
                    <p className="font-medium">
                      Session {report.session.sessionNumber}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(report.reportDate).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                </div>
                <Chip tone={report.status === "final" ? "success" : "warn"}>
                  {report.status}
                </Chip>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      {/* ─── Forms & assessments — unified intake + form-invite feed */}
      {adminCanEdit && (
        <Panel
          title={
            <span className="inline-flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Forms & assessments
            </span>
          }
          subtitle={
            feed.length === 0
              ? undefined
              : `${feed.length} item${feed.length === 1 ? "" : "s"}`
          }
        >
          {feed.length === 0 ? (
            <Empty>
              No intake items or form invites for {client.firstName} yet.
            </Empty>
          ) : (
            <div className="divide-y divide-border">
              {feed.map((row) => {
                const tone: "success" | "warn" | "info" | "neutral" =
                  row.status === "completed" || row.status === "submitted"
                    ? "success"
                    : row.status === "opened"
                      ? "info"
                      : row.status === "sent"
                        ? "warn"
                        : "neutral";
                const rowBody = (
                  <div className="flex items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {row.label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.kind === "intake" ? "Intake" : "Form"} ·{" "}
                        {row.when.toLocaleDateString("en-GB")}
                      </p>
                    </div>
                    <Chip tone={tone}>{row.status}</Chip>
                  </div>
                );
                return row.href ? (
                  <Link
                    key={row.id}
                    href={row.href}
                    className="block transition-colors hover:bg-muted/20"
                    target={row.href.startsWith("http") ? "_blank" : undefined}
                    rel={
                      row.href.startsWith("http")
                        ? "noopener noreferrer"
                        : undefined
                    }
                  >
                    {rowBody}
                  </Link>
                ) : (
                  <div key={row.id}>{rowBody}</div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* ─── Home programme — pulled from the latest report on file ── */}
      {adminCanEdit && (
        <Panel
          title={
            <span className="inline-flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" />
              Home programme
            </span>
          }
          subtitle={
            reportWithProgramme
              ? `From report dated ${new Date(reportWithProgramme.reportDate).toLocaleDateString("en-GB")}`
              : undefined
          }
          actions={
            reportWithProgramme && (
              <Link
                href={`/reports/${reportWithProgramme.id}`}
                className="ds-link inline-flex items-center text-xs"
              >
                Open report
                <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            )
          }
          padded
        >
          {homeProgrammeText ? (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
              {homeProgrammeText}
            </pre>
          ) : (
            <Empty>
              No home programme yet. Generate one inside a report and it'll
              appear here automatically.
            </Empty>
          )}
        </Panel>
      )}

      <ProgressNotesSection clientId={client.id} />

      <GoalsSection clientId={client.id} isAdmin={adminCanEdit} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Overview cell — one stat in the "Where we are" grid               */
/* ------------------------------------------------------------------ */

function OverviewCell({
  icon,
  label,
  value,
  valueTone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueTone: "success" | "warn" | "neutral";
}) {
  const toneClass =
    valueTone === "success"
      ? "text-green-700 dark:text-green-400"
      : valueTone === "warn"
        ? "text-amber-700 dark:text-amber-400"
        : "text-muted-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className={`mt-1.5 text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

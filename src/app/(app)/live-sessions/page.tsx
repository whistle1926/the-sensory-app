import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  Circle,
  PlayCircle,
  Plus,
  Radio,
  Settings,
  Users,
  Video,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Toolbar, Panel, Chip } from "@/components/ds";

export const dynamic = "force-dynamic";

/**
 * Phase 1 landing for the live-streaming feature.
 *
 * The live-stream package lives under /livestream in the repo root and is
 * a self-contained port target from CORE/core-invoice. This page lists
 * any LiveRoom rows that exist (schema is already in place), and surfaces
 * the configuration state — LiveKit credentials aren't wired yet, so the
 * primary CTA routes to a setup explainer.
 *
 * Once the LiveKit credentials + API routes are ported in Phase 2, the
 * Go Live / Host Studio / Public Viewer links will become functional.
 */
export default async function LiveSessionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "CLIENT") redirect("/portal");

  const rooms = await prisma.liveRoom.findMany({
    orderBy: [{ status: "asc" }, { scheduledStart: "asc" }],
    include: {
      host: { select: { id: true, name: true, email: true } },
      _count: { select: { recordings: true } },
    },
  });

  const live = rooms.filter((r) => r.status === "live");
  const scheduled = rooms.filter((r) => r.status === "scheduled");
  const past = rooms.filter((r) => r.status === "ended" || r.status === "cancelled");

  // Credentials check — LiveKit can't do anything without these.
  const hasLiveKit =
    !!process.env.LIVEKIT_API_KEY &&
    !!process.env.LIVEKIT_API_SECRET &&
    !!process.env.LIVEKIT_WS_URL;

  return (
    <div className="space-y-6">
      <Toolbar
        title="Live Sessions"
        subtitle="Broadcast or run interactive video rooms with live chat, reactions, pinned links, and recording."
        actions={
          hasLiveKit ? (
            <Link
              href="/live-sessions/new"
              className={buttonVariants({ className: "rounded-xl" })}
            >
              <Plus className="mr-2 h-4 w-4" />
              New session
            </Link>
          ) : (
            <Link
              href="/live-sessions/setup"
              className={buttonVariants({
                variant: "outline",
                className: "rounded-xl",
              })}
            >
              <Settings className="mr-2 h-4 w-4" />
              Set up LiveKit
            </Link>
          )
        }
      />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="ds-kpi">
          <div className="ds-kpi-head">
            <span className="ds-kpi-label">Live now</span>
            <span className="ds-kpi-icon">
              <Circle className="h-4 w-4" />
            </span>
          </div>
          <span className="ds-kpi-value ds-tabular">{live.length}</span>
          <div className="ds-kpi-foot">
            <span>Broadcasting right now</span>
          </div>
        </div>
        <div className="ds-kpi">
          <div className="ds-kpi-head">
            <span className="ds-kpi-label">Scheduled</span>
            <span className="ds-kpi-icon">
              <Radio className="h-4 w-4" />
            </span>
          </div>
          <span className="ds-kpi-value ds-tabular">{scheduled.length}</span>
          <div className="ds-kpi-foot">
            <span>Upcoming rooms</span>
          </div>
        </div>
        <div className="ds-kpi">
          <div className="ds-kpi-head">
            <span className="ds-kpi-label">Past sessions</span>
            <span className="ds-kpi-icon">
              <PlayCircle className="h-4 w-4" />
            </span>
          </div>
          <span className="ds-kpi-value ds-tabular">{past.length}</span>
          <div className="ds-kpi-foot">
            <span>Ended or cancelled</span>
          </div>
        </div>
        <div className="ds-kpi">
          <div className="ds-kpi-head">
            <span className="ds-kpi-label">Recordings</span>
            <span className="ds-kpi-icon">
              <Video className="h-4 w-4" />
            </span>
          </div>
          <span className="ds-kpi-value ds-tabular">
            {rooms.reduce((s, r) => s + r._count.recordings, 0)}
          </span>
          <div className="ds-kpi-foot">
            <span>Saved replays</span>
          </div>
        </div>
      </div>

      {/* Setup required banner — when LiveKit env isn't configured */}
      {!hasLiveKit && (
        <Panel
          title={
            <span className="inline-flex items-center gap-2">
              <Settings className="h-4 w-4 text-amber-500" />
              Configure LiveKit to start streaming
            </span>
          }
          subtitle="The DB schema and admin surface are ready. Add LiveKit credentials to unlock the host studio + public viewer."
          padded
        >
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              The live-streaming feature runs on{" "}
              <a
                href="https://livekit.io/"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                LiveKit
              </a>
              . Sign up for a free LiveKit Cloud project (or self-host), then
              add three environment variables to your Vercel project:
            </p>
            <pre className="rounded-xl border border-border bg-muted/40 p-3 text-xs">
              {`LIVEKIT_API_KEY=api_xxxxx
LIVEKIT_API_SECRET=secret_xxxxx
LIVEKIT_WS_URL=wss://your-project.livekit.cloud`}
            </pre>
            <p className="text-sm leading-relaxed text-muted-foreground">
              For recording, you&apos;ll also need an S3-compatible bucket
              (Supabase Storage, R2, or AWS) — see{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                livestream/.env.example
              </code>{" "}
              for the full list.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <a
                href="https://cloud.livekit.io/projects"
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ className: "rounded-xl" })}
              >
                <Radio className="mr-2 h-4 w-4" />
                Open LiveKit Cloud
              </a>
              <a
                href="/livestream/README.md"
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({
                  variant: "outline",
                  className: "rounded-xl",
                })}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Package README
              </a>
            </div>
          </div>
        </Panel>
      )}

      {/* Live now */}
      {live.length > 0 && (
        <Panel
          title={
            <span className="inline-flex items-center gap-2">
              <Circle className="h-3.5 w-3.5 fill-red-500 text-red-500" />
              Live now
            </span>
          }
          subtitle={`${live.length} session${live.length === 1 ? "" : "s"} broadcasting`}
        >
          <SessionList rooms={live} />
        </Panel>
      )}

      {/* Scheduled */}
      <Panel
        title="Upcoming sessions"
        subtitle={
          scheduled.length === 0
            ? "Nothing scheduled"
            : `${scheduled.length} scheduled`
        }
      >
        {scheduled.length === 0 ? (
          <div className="ds-empty">
            <Radio
              className="mx-auto h-8 w-8"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            />
            <p style={{ marginTop: 10, fontWeight: 600 }}>
              No scheduled sessions
            </p>
            <p style={{ marginTop: 4, fontSize: 12 }}>
              {hasLiveKit
                ? "Click New session to schedule your first broadcast."
                : "Configure LiveKit to create your first session."}
            </p>
          </div>
        ) : (
          <SessionList rooms={scheduled} />
        )}
      </Panel>

      {/* Past */}
      {past.length > 0 && (
        <Panel
          title="Past sessions"
          subtitle={`${past.length} ended or cancelled`}
        >
          <SessionList rooms={past} />
        </Panel>
      )}
    </div>
  );
}

/* ─── Session row list ─────────────────────────────────────────── */

interface RoomRow {
  id: string;
  title: string;
  description: string;
  mode: string;
  status: string;
  scheduledStart: Date;
  host: { id: string; name: string; email: string } | null;
  _count: { recordings: number };
}

function SessionList({ rooms }: { rooms: RoomRow[] }) {
  return (
    <div className="divide-y divide-border">
      {rooms.map((r) => {
        const statusTone: "success" | "primary" | "warn" | "neutral" =
          r.status === "live"
            ? "success"
            : r.status === "scheduled"
              ? "primary"
              : r.status === "cancelled"
                ? "warn"
                : "neutral";
        const modeTone: "info" | "primary" =
          r.mode === "interactive" ? "info" : "primary";
        return (
          <Link
            key={r.id}
            href={`/live-sessions/${r.id}`}
            className="flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/20"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{r.title}</h3>
                <Chip tone={statusTone}>{labelForStatus(r.status)}</Chip>
                <Chip tone={modeTone}>
                  {r.mode === "interactive" ? "Interactive" : "Broadcast"}
                </Chip>
              </div>
              {r.description && (
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {r.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {new Date(r.scheduledStart).toLocaleString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {r.host && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {r.host.name}
                  </span>
                )}
                {r._count.recordings > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Video className="h-3 w-3" />
                    {r._count.recordings} recording
                    {r._count.recordings === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function labelForStatus(s: string): string {
  switch (s) {
    case "live":
      return "Live";
    case "scheduled":
      return "Scheduled";
    case "ended":
      return "Ended";
    case "cancelled":
      return "Cancelled";
    default:
      return s;
  }
}


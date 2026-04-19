import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Radio } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Toolbar, Panel, Chip, Empty } from "@/components/ds";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface RoomRow {
  id: string;
  title: string;
  description: string;
  mode: string;
  status: string;
  scheduledStart: Date;
  _count: { recordings: number };
}

/**
 * Live Sessions — admin landing. Simplified version: list sessions + one
 * Create button. Full-fat KPIs/sections come back once we're stable.
 */
export default async function LiveSessionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "CLIENT") redirect("/portal");

  const hasLiveKit =
    !!process.env.LIVEKIT_API_KEY &&
    !!process.env.LIVEKIT_API_SECRET &&
    !!process.env.LIVEKIT_WS_URL;

  let rooms: RoomRow[] = [];
  let queryError: string | null = null;
  try {
    rooms = await prisma.liveRoom.findMany({
      orderBy: [{ scheduledStart: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        mode: true,
        status: true,
        scheduledStart: true,
        _count: { select: { recordings: true } },
      },
    });
  } catch (err: unknown) {
    queryError =
      err instanceof Error
        ? `${err.name}: ${err.message}`
        : "Unknown Prisma error";
  }

  return (
    <div className="space-y-6">
      <Toolbar
        title="Live Sessions"
        subtitle="Broadcast or run interactive video rooms."
        actions={
          <Link
            href="/live-sessions/new"
            className={buttonVariants({ className: "rounded-xl" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            New session
          </Link>
        }
      />

      {queryError && (
        <Panel title="⚠️ Database query failed" padded>
          <pre className="overflow-x-auto rounded-lg bg-red-50 p-3 text-xs text-red-900 dark:bg-red-950/40 dark:text-red-200">
            {queryError}
          </pre>
        </Panel>
      )}

      {!hasLiveKit && !queryError && (
        <Panel title="LiveKit not configured" padded>
          <p className="text-sm text-muted-foreground">
            Add <code className="rounded bg-muted px-1">LIVEKIT_API_KEY</code>,{" "}
            <code className="rounded bg-muted px-1">LIVEKIT_API_SECRET</code>,
            and{" "}
            <code className="rounded bg-muted px-1">LIVEKIT_WS_URL</code>{" "}
            to your Vercel project and redeploy.
          </p>
        </Panel>
      )}

      <Panel
        title="All sessions"
        subtitle={`${rooms.length} total`}
      >
        {rooms.length === 0 ? (
          <div className="ds-empty">
            <Radio
              className="mx-auto h-8 w-8"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            />
            <p style={{ marginTop: 10, fontWeight: 600 }}>
              No sessions yet
            </p>
            <p style={{ marginTop: 4, fontSize: 12 }}>
              Click <strong>New session</strong> to schedule your first
              broadcast.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {rooms.map((r) => (
              <Link
                key={r.id}
                href={`/live-sessions/${r.id}`}
                className="flex items-start justify-between gap-4 px-5 py-4 transition hover:bg-muted/20"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{r.title}</h3>
                    <Chip tone={toneFor(r.status)}>
                      {r.status[0].toUpperCase() + r.status.slice(1)}
                    </Chip>
                    <Chip tone={r.mode === "interactive" ? "info" : "primary"}>
                      {r.mode === "interactive" ? "Interactive" : "Broadcast"}
                    </Chip>
                  </div>
                  {r.description && (
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {r.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Scheduled{" "}
                    {new Date(r.scheduledStart).toLocaleString("en-GB")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      {/* Keeping Empty so the DS import stays tree-shaken correctly */}
      <div className="hidden">
        <Empty>placeholder</Empty>
      </div>
    </div>
  );
}

function toneFor(
  status: string,
): "success" | "primary" | "warn" | "neutral" {
  if (status === "live") return "success";
  if (status === "scheduled") return "primary";
  if (status === "cancelled") return "warn";
  return "neutral";
}

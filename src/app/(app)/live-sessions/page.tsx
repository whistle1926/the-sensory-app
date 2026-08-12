import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Radio } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Toolbar, Panel, Chip } from "@/components/ds";

export const dynamic = "force-dynamic";

/**
 * Live Sessions index.
 *
 * Server component — fetches rooms and renders the toolbar + list. Uses
 * plain Tailwind classes for the "New session" button rather than the
 * `buttonVariants` helper, because `@/components/ui/button` is a client
 * component and re-exporting a function from it makes React refuse to call
 * it from the server ("Attempted to call buttonVariants() from the server").
 */
export default async function LiveSessionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "CLIENT") redirect("/portal");

  const rooms = await prisma.liveRoom.findMany({
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

  return (
    <div className="space-y-6">
      <Toolbar
        title="Live Sessions"
        subtitle="Broadcast or run interactive video rooms."
        actions={
          <Link
            href="/live-sessions/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-xs)] transition hover:brightness-110 hover:shadow-[var(--shadow-glow)]"
          >
            <Plus className="h-4 w-4" />
            New session
          </Link>
        }
      />

      <Panel title="All sessions" subtitle={`${rooms.length} total`}>
        {rooms.length === 0 ? (
          <div className="ds-empty">
            <Radio
              className="mx-auto h-8 w-8"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            />
            <p style={{ marginTop: 10, fontWeight: 600 }}>No sessions yet</p>
            <p style={{ marginTop: 4, fontSize: 12 }}>
              Click <strong>New session</strong>{" "}to schedule your first
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

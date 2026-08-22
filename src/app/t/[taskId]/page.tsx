import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyTriageToken } from "@/lib/task-triage";
import { TriageButtons } from "@/components/tasks/triage-buttons";

export const dynamic = "force-dynamic";

/**
 * The page an email button opens.
 *
 * Read-only on purpose: link scanners follow URLs in the background, so
 * nothing changes until the button here is pressed.
 */
export default async function TriagePage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ u?: string; k?: string }>;
}) {
  const { taskId } = await params;
  const { u = "", k = "" } = await searchParams;
  if (!verifyTriageToken(taskId, u, k)) notFound();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      status: true,
      agentQueuedAt: true,
      parkedAt: true,
      createdBy: { select: { name: true } },
    },
  });
  if (!task) notFound();

  const already = task.agentQueuedAt
    ? "actioned"
    : task.parkedAt
      ? "parked"
      : null;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-5 py-10">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          From {task.createdBy?.name || "the board"}
        </p>
        <h1 className="mt-1 text-xl font-black leading-snug">{task.title}</h1>

        {already && (
          <p className="mt-4 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
            You already marked this <strong>{already}</strong>. Choosing again
            just changes it.
          </p>
        )}

        <TriageButtons taskId={task.id} userId={u} token={k} />

        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          Nothing has changed yet — pressing one of these is what does it.
          Either can be changed later on the board.
        </p>
      </div>
    </div>
  );
}

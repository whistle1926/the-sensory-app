"use client";

import Link from "next/link";
import { Lock, Circle, CheckCircle2, XCircle, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type ModuleStatus = "LOCKED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface OutlineModule {
  id: string;
  title: string;
  order: number;
  status: ModuleStatus;
}

interface Props {
  courseId: string;
  courseTitle: string;
  modules: OutlineModule[];
  currentModuleId: string;
  completedCount: number;
  totalCount: number;
}

function StatusIcon({ status }: { status: ModuleStatus }) {
  const base = "h-4 w-4 shrink-0";
  switch (status) {
    case "LOCKED":
      return <Lock className={cn(base, "text-muted-foreground")} />;
    case "IN_PROGRESS":
      return <Circle className={cn(base, "text-primary")} />;
    case "COMPLETED":
      return <CheckCircle2 className={cn(base, "text-green-600")} />;
    case "FAILED":
      return <XCircle className={cn(base, "text-red-500")} />;
  }
}

export function CourseOutlineSidebar({
  courseId,
  courseTitle,
  modules,
  currentModuleId,
  completedCount,
  totalCount,
}: Props) {
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <aside className="space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
      <Link
        href={`/portal/training/${courseId}`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Course overview
      </Link>

      <div>
        <p className="truncate text-sm font-semibold">{courseTitle}</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">{pct}%</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {completedCount} of {totalCount} modules
        </p>
      </div>

      <nav className="space-y-1">
        {modules.map((m, i) => {
          const isCurrent = m.id === currentModuleId;
          const clickable = m.status !== "LOCKED" && !isCurrent;
          const body = (
            <div
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs transition-colors",
                isCurrent
                  ? "border-primary bg-secondary font-semibold"
                  : clickable
                  ? "border-border hover:border-primary/40 hover:bg-muted"
                  : "border-border opacity-60"
              )}
            >
              <span className="w-5 shrink-0 font-semibold text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 leading-snug">{m.title}</span>
              <StatusIcon status={m.status} />
            </div>
          );
          return clickable ? (
            <Link key={m.id} href={`/portal/training/${courseId}/${m.id}`}>
              {body}
            </Link>
          ) : (
            <div key={m.id}>{body}</div>
          );
        })}
      </nav>
    </aside>
  );
}

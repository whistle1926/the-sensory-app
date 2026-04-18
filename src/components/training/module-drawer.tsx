"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Lock, PlayCircle, X } from "lucide-react";

type ModuleStatus = "LOCKED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface DrawerModule {
  id: string;
  title: string;
  order: number;
  status: ModuleStatus;
}

interface Props {
  open: boolean;
  onClose: () => void;
  courseId: string;
  courseTitle: string;
  modules: DrawerModule[];
  currentId: string;
  progressPercent: number;
}

/**
 * Slide-in module list for the lesson player.
 *
 * Replaces the permanent left-rail sidebar with a focused drawer you open
 * only when you need to jump around. Keeps the reading surface distraction-
 * free when you're actually learning.
 */
export function ModuleDrawer({
  open,
  onClose,
  courseId,
  courseTitle,
  modules,
  currentId,
  progressPercent,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="lp-drawer-backdrop"
        onClick={onClose}
        aria-hidden
      />
      <aside className="lp-drawer" role="dialog" aria-label="Course modules">
        <div className="lp-drawer-head">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Course
              </p>
              <p className="mt-1 truncate text-sm font-bold">{courseTitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
              {progressPercent}%
            </span>
          </div>
          <Link
            href={`/portal/training/${courseId}`}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Back to course overview
          </Link>
        </div>

        <nav className="lp-drawer-body space-y-1">
          {modules.map((m) => {
            const isCurrent = m.id === currentId;
            const isLocked = m.status === "LOCKED";
            const isComplete = m.status === "COMPLETED";
            const classes = [
              "lp-drawer-row",
              isCurrent ? "is-current" : "",
              isLocked ? "is-locked" : "",
              isComplete ? "is-complete" : "",
            ]
              .filter(Boolean)
              .join(" ");
            const body = (
              <>
                <span className="num">{m.order + 1}</span>
                <span className="flex-1 truncate text-sm">{m.title}</span>
                {isLocked ? (
                  <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : isComplete ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                ) : (
                  <PlayCircle className="h-4 w-4 shrink-0 text-primary" />
                )}
              </>
            );
            if (isLocked || isCurrent) {
              return (
                <div key={m.id} className={classes}>
                  {body}
                </div>
              );
            }
            return (
              <Link
                key={m.id}
                href={`/portal/training/${courseId}/${m.id}`}
                className={classes}
                onClick={onClose}
              >
                {body}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

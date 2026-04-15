"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavTarget {
  id: string;
  title: string;
}

interface Props {
  courseId: string;
  prev: NavTarget | null;
  next: NavTarget | null;
  nextLocked: boolean;
  nextLabel?: string;
}

export function LessonNavBar({
  courseId,
  prev,
  next,
  nextLocked,
  nextLabel = "Next module",
}: Props) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/90 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
      <div className="flex items-center justify-between gap-3">
        {prev ? (
          <Link
            href={`/portal/training/${courseId}/${prev.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Previous</span>
            <span className="max-w-[140px] truncate text-muted-foreground sm:ml-1">
              {prev.title}
            </span>
          </Link>
        ) : (
          <span />
        )}

        {next ? (
          nextLocked ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground"
              )}
              title="Pass this module's quiz to unlock the next one."
            >
              <span className="hidden sm:inline">{nextLabel}</span>
              <span className="max-w-[140px] truncate">{next.title}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          ) : (
            <Link
              href={`/portal/training/${courseId}/${next.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/80"
            >
              <span className="hidden sm:inline">{nextLabel}</span>
              <span className="max-w-[140px] truncate">{next.title}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )
        ) : (
          <Link
            href={`/portal/training/${courseId}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Course overview
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

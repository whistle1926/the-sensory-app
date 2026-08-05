"use client";

import { useState } from "react";
import { ExternalLink, Monitor, Smartphone } from "lucide-react";
import {
  CourseDetailView,
  type CourseView,
} from "@/components/courses/course-detail-view";

/**
 * Live preview beside the course editor — it redraws as you type.
 *
 * It renders the SAME component the public /courses/[slug] page renders, fed
 * with the current (unsaved) form state. So it isn't a lookalike that can
 * drift: change the shared view and both move together. That matters because
 * an OT signs off here and a parent sees the result.
 *
 * Scaled down rather than shown at full width, so a desktop-width page still
 * fits beside the form. The phone toggle drops it to 390px, which is how most
 * parents will actually arrive.
 */
export function LivePreviewPane({
  course,
  isLive,
}: {
  course: CourseView;
  /** Whether this course is actually on sale — drives the badge wording. */
  isLive: boolean;
}) {
  const [device, setDevice] = useState<"phone" | "desktop">("desktop");

  const frameWidth = device === "phone" ? 390 : 1100;
  // A phone lays the page out much taller, so give it more room before the
  // wrapper starts scrolling.
  const contentHeight = device === "phone" ? 2600 : 1800;
  // Scale the rendered page down to fit the pane without clipping.
  const scale = device === "phone" ? 0.9 : 0.52;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={
            isLive
              ? "rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800 dark:bg-green-950/40 dark:text-green-300"
              : "rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
          }
        >
          {isLive ? "● On sale now" : "Preview only — not on sale yet"}
        </span>

        <div className="ml-auto inline-flex rounded-lg border border-border bg-background p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-semibold ${
              device === "desktop"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            Computer
          </button>
          <button
            type="button"
            onClick={() => setDevice("phone")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-semibold ${
              device === "phone"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Phone
          </button>
        </div>

        <a
          href={`/courses/${course.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Open the real page in a new tab"
          className="rounded-lg border border-border bg-background p-2 hover:bg-muted"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <p className="mb-2 text-xs text-muted-foreground">
        This updates as you type. Nothing here is visible to anyone else until
        you save and put the course on sale.
      </p>

      {/* The preview is display-only: pointer-events are off so nothing in it
          can be clicked or focused by mistake while editing. */}
      <div className="flex-1 overflow-auto rounded-xl border border-border bg-muted/30 p-3">
        {/* The scaled page is taller than the pane, so the wrapper scrolls.
            It used to be clipped at a fixed height, which cut the phone view
            off partway down. */}
        <div
          className="mx-auto overflow-hidden rounded-lg border border-border bg-white shadow-sm"
          style={{ width: frameWidth * scale, height: contentHeight * scale }}
        >
          <div
            className="pointer-events-none origin-top-left"
            style={{
              width: frameWidth,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            aria-hidden
          >
            <div style={{ width: frameWidth }}>
              <CourseDetailView course={course} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

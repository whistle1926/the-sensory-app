"use client";

import { useState } from "react";
import { Clock, PlayCircle, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuyDialog } from "./buy-dialog";
import { formatPrice } from "./course-card";

interface Props {
  courseId: string;
  courseTitle: string;
  price: number;
  duration: string;
  moduleCount: number;
}

/**
 * Right-rail buy panel used on the course detail page. Handles the click —
 * opens the BuyDialog which in turn handles signed-in vs guest branching.
 *
 * On mobile the panel still renders inline at the bottom of the page (parent
 * controls layout), but we also surface a sticky floor CTA below so the Buy
 * button is always one thumb-tap away.
 */
export function BuyPanel({
  courseId,
  courseTitle,
  price,
  duration,
  moduleCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const isFree = price === 0;

  return (
    <>
      <div className="rounded-3xl border border-border/80 bg-white p-6 shadow-[var(--shadow-sm)]">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {isFree ? "Free course" : "One-time purchase"}
        </p>
        <p className="mt-1 text-4xl font-black">{formatPrice(price)}</p>
        {!isFree && (
          <p className="mt-1 text-xs text-muted-foreground">
            Lifetime access. No subscription.
          </p>
        )}

        <Button
          className="mt-5 w-full"
          size="lg"
          onClick={() => setOpen(true)}
        >
          {isFree ? "Enrol for free" : `Buy — ${formatPrice(price)}`}
        </Button>

        <ul className="mt-6 space-y-2.5 text-sm">
          <li className="flex items-center gap-2.5 text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" />
            {duration}
          </li>
          <li className="flex items-center gap-2.5 text-muted-foreground">
            <PlayCircle className="h-4 w-4 text-primary" />
            {moduleCount} module{moduleCount === 1 ? "" : "s"} with quizzes
          </li>
          <li className="flex items-center gap-2.5 text-muted-foreground">
            <RefreshCw className="h-4 w-4 text-primary" />
            Work through it at your own pace
          </li>
          <li className="flex items-center gap-2.5 text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Certificate on completion
          </li>
        </ul>
      </div>

      {/* Sticky mobile CTA so the Buy button is always reachable */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-white/95 px-4 py-3 shadow-[0_-6px_18px_-10px_rgba(0,0,0,0.15)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{courseTitle}</p>
            <p className="text-lg font-black">{formatPrice(price)}</p>
          </div>
          <Button onClick={() => setOpen(true)}>
            {isFree ? "Enrol free" : "Buy"}
          </Button>
        </div>
      </div>

      <BuyDialog
        open={open}
        onOpenChange={setOpen}
        courseId={courseId}
        courseTitle={courseTitle}
        price={price}
      />
    </>
  );
}

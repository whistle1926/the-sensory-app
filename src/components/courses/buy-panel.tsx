"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Mail,
  FileText,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuyDialog } from "./buy-dialog";
import { formatPrice } from "./course-card";

interface Props {
  courseId: string;
  courseTitle: string;
  price: number;
  priceEur?: number | null;
  /** Used to link to the checkout page rather than open a dialog. */
  courseSlug: string;
  duration: string;
  moduleCount: number;
  /** Titles of the handouts attached to the course, shown as what you get. */
  resources?: string[];
  /** Only promise a certificate when the course actually gives one. */
  hasCertificate?: boolean;
}

/**
 * Right-rail buy panel used on the course detail page.
 *
 * After a successful free-course enrolment for a guest, we stop showing
 * the "Enrol for free" button and instead show a persistent "Check your
 * inbox" confirmation with a resend hint. This stops users from clicking
 * the button a second time thinking nothing happened.
 */
export function BuyPanel({
  courseId,
  courseTitle,
  price,
  priceEur,
  courseSlug,
  duration,
  moduleCount,
  resources,
  hasCertificate,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [enrolledEmail, setEnrolledEmail] = useState<string | null>(null);
  const isFree = price === 0;
  const justEnrolled = !!enrolledEmail;

  return (
    <>
      <div className="sub-edge-lg rounded-[30px] bg-white p-7">
        <p className="text-[13px] font-extrabold uppercase tracking-[1.4px] text-[#6B7794]">
          {isFree ? "Free course" : "One-time purchase"}
        </p>
        <p className="sub-display mt-1 text-[42px]">{formatPrice(price)}</p>
        {!isFree && !justEnrolled && (
          <p className="mt-1 text-xs text-muted-foreground">
            Lifetime access. No subscription.
          </p>
        )}

        {justEnrolled ? (
          // Post-enrolment confirmation state — replaces the CTA so the
          // user knows their action landed.
          <div className="mt-5 space-y-3">
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900/40 dark:bg-green-950/20">
              <p className="flex items-center gap-2 font-semibold text-green-900 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4" />
                You're enrolled
              </p>
              <p className="mt-1 text-xs text-green-900/80 dark:text-green-300/80">
                We've emailed a set-password link to{" "}
                <span className="font-semibold">{enrolledEmail}</span>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="flex-1"
                size="sm"
                onClick={() => router.push(`/courses/${courseSlug}/checkout`)}
              >
                <Mail className="mr-1.5 h-3.5 w-3.5" />
                Didn&apos;t get it?
              </Button>
              <Link
                href="/login"
                className="inline-flex items-center rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:brightness-110"
              >
                Sign in
              </Link>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="sub-display sub-edge-lg sub-press mt-5 w-full rounded-full px-6 py-4 text-xl text-white"
            style={{ background: "var(--sub-pink)" }}
            onClick={() => router.push(`/courses/${courseSlug}/checkout`)}
          >
            {isFree ? "Enrol for free" : `Buy — ${formatPrice(price)}`}
          </button>
        )}

        <ul className="mt-6 space-y-2.5 text-[15px] font-semibold">
          <li className="flex items-center gap-2.5 text-[#3D4A6B]">
            <Clock className="h-4 w-4 text-[#E71D57]" />
            {duration}
          </li>
          {resources && resources.length > 0 && (
            <li className="flex items-start gap-2.5 text-[#3D4A6B]">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#E71D57]" />
              <span>
                Includes{" "}
                {resources.length === 1
                  ? resources[0]
                  : `${resources.length} downloads: ${resources.join(", ")}`}
              </span>
            </li>
          )}
          <li className="flex items-center gap-2.5 text-[#3D4A6B]">
            <RefreshCw className="h-4 w-4 text-[#E71D57]" />
            Work through it at your own pace
          </li>
          {hasCertificate && (
            <li className="flex items-center gap-2.5 text-[#3D4A6B]">
              <ShieldCheck className="h-4 w-4 text-[#E71D57]" />
              Certificate on completion
            </li>
          )}
        </ul>
      </div>

      {/* Sticky mobile CTA so the Buy / enrolment confirmation is always
          reachable on a narrow viewport. */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t-[3px] border-[#12235B] bg-white px-4 py-3 md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[#6B7794]">{courseTitle}</p>
            <p className="sub-display text-xl">
              {justEnrolled ? "Enrolled" : formatPrice(price)}
            </p>
          </div>
          {justEnrolled ? (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110"
            >
              Sign in
            </Link>
          ) : (
            <button
              type="button"
              className="sub-edge sub-press rounded-full px-5 py-2.5 text-[15px] font-extrabold text-white"
              style={{ background: "var(--sub-pink)" }}
              onClick={() => router.push(`/courses/${courseSlug}/checkout`)}
            >
              {isFree ? "Enrol free" : "Buy"}
            </button>
          )}
        </div>
      </div>

      <BuyDialog
        open={open}
        onOpenChange={setOpen}
        courseId={courseId}
        courseTitle={courseTitle}
        price={price}
        priceEur={priceEur}
        onEnrolled={(email) => setEnrolledEmail(email)}
      />
    </>
  );
}

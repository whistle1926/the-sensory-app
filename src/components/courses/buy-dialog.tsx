"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Lock,
  Mail,
  Sparkles,
} from "lucide-react";
import { formatPrice } from "./course-card";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courseId: string;
  courseTitle: string;
  price: number;
  /** Called when a free-course guest successfully enrols and receives an
   *  email. Lets the parent page swap the "Enrol for free" CTA for a
   *  "Check your inbox" state so the user doesn't double-submit. */
  onEnrolled?: (email: string) => void;
}

/**
 * Hybrid buy dialog — signed-in users get a single "Confirm" button;
 * guests get a lightweight name + email form. Handles free and paid
 * courses; only mentions FireBuddy when payment is actually involved.
 *
 * On free-guest success we swap to a fuller "what to do next" panel
 * with troubleshooting + a resend option, so the user never wonders
 * whether the request went through.
 */
export function BuyDialog({
  open,
  onOpenChange,
  courseId,
  courseTitle,
  price,
  onEnrolled,
}: Props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isFree = price === 0;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<null | { email: string }>(null);

  // Resend-email state for the success panel
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<
    { tone: "ok" | "err"; text: string } | null
  >(null);

  useEffect(() => {
    if (open) {
      setError("");
      setSuccess(null);
      setSubmitting(false);
      setResendMsg(null);
    }
  }, [open]);

  async function submit() {
    setError("");
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { courseId, website: honeypot };
      if (!session?.user) {
        if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setError("Please enter your name and a valid email.");
          setSubmitting(false);
          return;
        }
        payload.name = name.trim();
        payload.email = email.trim().toLowerCase();
      }

      const res = await fetch("/api/courses/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      if (data.paymentUrl) {
        // Paid course — off to FireBuddy.
        window.location.href = data.paymentUrl as string;
        return;
      }
      if (data.redirect) {
        // Free course + signed-in user, or already-enrolled.
        router.push(data.redirect as string);
        return;
      }
      if (data.checkEmail) {
        // Free-course guest — account created, set-password email on the way.
        const emailUsed = email.trim().toLowerCase();
        setSuccess({ email: emailUsed });
        setSubmitting(false);
        onEnrolled?.(emailUsed);
        return;
      }
      // Fallback (shouldn't normally hit, but surface something)
      setSuccess({ email: email.trim().toLowerCase() });
      setSubmitting(false);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!success?.email) return;
    setResending(true);
    setResendMsg(null);
    try {
      const res = await fetch("/api/courses/public/resend-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: success.email, courseId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResendMsg({
          tone: "err",
          text:
            data.error ||
            "Couldn't resend right now. Please try again shortly.",
        });
      } else {
        setResendMsg({
          tone: "ok",
          text: `Fresh link sent to ${success.email}.`,
        });
      }
    } catch {
      setResendMsg({ tone: "err", text: "Network error. Please try again." });
    }
    setResending(false);
  }

  // ── Success panel (free-course guest path) ─────────────────────────
  if (success?.email) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              You're enrolled!
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900/40 dark:bg-green-950/20">
              <p className="flex items-center gap-2 font-medium text-green-900 dark:text-green-300">
                <Mail className="h-4 w-4" />
                Check your inbox
              </p>
              <p className="mt-1 text-xs text-green-900/80 dark:text-green-300/80">
                We've sent a link to{" "}
                <span className="font-semibold">{success.email}</span>. Click
                it, pick a password, and you'll drop straight into{" "}
                <span className="font-semibold">{courseTitle}</span>.
              </p>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="flex items-start gap-2">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Usually arrives within a minute. Check your spam / junk folder
                if not.
              </p>
              <p className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                The link is valid for 14 days and opens the course after you
                set a password.
              </p>
            </div>

            {resendMsg && (
              <p
                className={`rounded-md p-2 text-xs ${
                  resendMsg.tone === "ok"
                    ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                    : "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                }`}
              >
                {resendMsg.text}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button
                variant="outline"
                onClick={handleResend}
                disabled={resending}
                size="sm"
              >
                {resending && (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                )}
                {resending ? "Sending…" : "Resend email"}
              </Button>
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Already set a password? Sign in
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            <Button
              className="w-full"
              onClick={() => onOpenChange(false)}
              variant="default"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isFree ? "Enrol in this course" : "Buy this course"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl bg-muted/40 p-3 text-sm">
            <p className="font-semibold">{courseTitle}</p>
            <p className="mt-1 text-muted-foreground">
              {isFree
                ? "Free — enrol instantly"
                : `${formatPrice(price)} · one-time`}
            </p>
          </div>

          {status === "loading" ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : session?.user ? (
            <div className="rounded-xl border border-border bg-background p-3 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {session.user.email}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Signed in — we'll enrol this account directly.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Your name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jamie Parent"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <p className="text-[11px] text-muted-foreground">
                  {isFree
                    ? "We'll create your account and email you a link to set a password."
                    : "We'll email you receipts and a link to set your password after payment."}
                </p>
              </div>
              {/* Honeypot */}
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                autoComplete="off"
                tabIndex={-1}
                aria-hidden
                style={{
                  position: "absolute",
                  left: "-9999px",
                  width: 1,
                  height: 1,
                  opacity: 0,
                  pointerEvents: "none",
                }}
              />
            </div>
          )}

          {error && (
            <p className="rounded-md bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              {isFree ? (
                <>
                  <Sparkles className="h-3 w-3" /> No payment · no card needed
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3" /> Secure checkout via FireBuddy
                </>
              )}
            </p>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isFree ? "Enrol now" : `Pay ${formatPrice(price)}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, CheckCircle2, Mail } from "lucide-react";
import { formatPrice } from "./course-card";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courseId: string;
  courseTitle: string;
  price: number;
}

/**
 * Hybrid buy dialog — signed-in users get a single "Confirm & pay" button;
 * guests get a lightweight name + email form. Handles both free and paid
 * courses the same way, redirecting to FireBuddy when price > 0.
 */
export function BuyDialog({
  open,
  onOpenChange,
  courseId,
  courseTitle,
  price,
}: Props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isFree = price === 0;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<null | { checkEmail: boolean }>(null);

  useEffect(() => {
    if (open) {
      setError("");
      setSuccess(null);
      setSubmitting(false);
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
        setSuccess({ checkEmail: true });
        setSubmitting(false);
        return;
      }
      // Fallback
      setSuccess({ checkEmail: false });
      setSubmitting(false);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  // Success panel (free-course guest path)
  if (success?.checkEmail) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="py-2 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
            <h2 className="mt-3 text-xl font-bold">You're enrolled!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We've sent a set-password link to{" "}
              <span className="font-semibold text-foreground">{email}</span>.
              Open it, pick a password, and dive into the course.
            </p>
            <Button
              className="mt-5"
              onClick={() => onOpenChange(false)}
              variant="outline"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
              {isFree ? "Free — enrol instantly" : `${formatPrice(price)} · one-time`}
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
                  We'll create your account and email you a link to set a
                  password.
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
              <Lock className="h-3 w-3" /> Secure checkout via FireBuddy
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

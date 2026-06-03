"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { signIn, getSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Award, BookOpen, Heart, Sparkles, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Public sign-in page for parents, carers and learners.
 *
 *   - On success, role decides destination: CLIENT → /portal, staff
 *     → /dashboard.
 *   - Banner messages drive off query flags:
 *       ?fromSetup=1   → from the password-setup flow
 *       ?registered=1  → just created an account but auto-signin
 *                        didn't fire (fall-through path from /register)
 *   - Layout mirrors /register so the two pages feel like a pair.
 */
function LoginInner() {
  const searchParams = useSearchParams();
  const fromSetup = searchParams.get("fromSetup") === "1";
  const justRegistered = searchParams.get("registered") === "1";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }
      if (result?.ok) {
        const session = await getSession();
        const role = session?.user?.role;
        window.location.href = role === "CLIENT" ? "/portal" : "/dashboard";
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-5xl">
      <div className="grid items-center gap-10 md:grid-cols-[1.05fr_1fr]">
        {/* Form column */}
        <div>
          <div className="mb-8">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M4 4h7v7H4V4Z" fill="white" opacity="0.9" />
                <path d="M13 4h7v7h-7V4Z" fill="white" opacity="0.6" />
                <path d="M4 13h7v7H4v-7Z" fill="white" opacity="0.6" />
                <path d="M13 13h7v7h-7v-7Z" fill="white" opacity="0.9" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to access your courses, bookings and home programmes.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            {fromSetup && (
              <div className="mb-4 rounded-xl bg-green-50 p-3 text-sm font-medium text-green-700 dark:bg-green-950/50 dark:text-green-400">
                Password set. Sign in to continue.
              </div>
            )}
            {justRegistered && (
              <div className="mb-4 rounded-xl bg-green-50 p-3 text-sm font-medium text-green-700 dark:bg-green-950/50 dark:text-green-400">
                Account created. Sign in to continue.
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600 dark:bg-red-950/50 dark:text-red-400">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium text-foreground/80"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-foreground/80"
                >
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="h-11 rounded-xl"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/80"
              >
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </div>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            New to The Sensory Submarine?{" "}
            <Link
              href="/register"
              className="font-medium text-primary hover:underline"
            >
              Create an account
            </Link>
          </div>

          <div className="mt-3 text-center text-sm text-muted-foreground">
            Or{" "}
            <Link
              href="/book"
              className="font-medium text-primary hover:underline"
            >
              book your first session
            </Link>{" "}
            without signing up.
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/admin/login"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Staff login
            </Link>
          </div>
        </div>

        {/* Marketing column — hidden on small screens to keep the
            form front-and-centre on mobile. */}
        <aside className="hidden md:block">
          <div className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              The Sensory Submarine
            </div>
            <h2 className="mt-3 text-xl font-bold tracking-tight">
              Everything for your child in one place
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your courses, bookings and home programmes are saved across
              devices. Sign in to pick up exactly where you left off.
            </p>

            <ul className="mt-5 space-y-4">
              <li className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BookOpen className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Courses</p>
                  <p className="text-xs text-muted-foreground">
                    Resume modules, re-watch sessions, download handouts.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Video className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Bookings</p>
                  <p className="text-xs text-muted-foreground">
                    See upcoming sessions, manage rescheduling and notes.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Heart className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Home programmes</p>
                  <p className="text-xs text-muted-foreground">
                    Your personalised plan, kept up to date by Grace.
                  </p>
                </div>
              </li>
            </ul>

            <div className="mt-6 flex items-center gap-4 border-t border-border pt-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-amber-500" />
                CPD-accredited
              </span>
              <span>OT-led · evidence-based</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

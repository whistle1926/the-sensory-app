"use client";

import { Suspense, useEffect, useState } from "react";
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
  // Email-code fallback: "ask" collects the address, "enter" collects the code.
  const [codeStep, setCodeStep] = useState<"off" | "ask" | "enter">("off");
  const [codeEmail, setCodeEmail] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");

  async function requestCode() {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const res = await fetch("/api/login-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: codeEmail }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(j.error ?? "Couldn't send a code.");
      setNotice(j.message ?? "If that address has an account, the code is on its way.");
      setCodeStep("enter");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send a code.");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("login-code", {
        email: codeEmail,
        code,
        redirect: false,
      });
      if (result?.error || !result?.ok) {
        setError("That code wasn't right, or it's expired.");
        setCode("");
        setLoading(false);
        return;
      }
      await afterSignIn();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }
  async function afterSignIn() {
    const session = await getSession();
    const role = session?.user?.role;
    window.location.href = role === "CLIENT" ? "/portal" : "/dashboard";
  }

  async function signInWithPasskey() {
    setError("");
    setLoading(true);
    try {
      const optRes = await fetch("/api/passkey/login");
      if (!optRes.ok) throw new Error("start failed");
      const options = await optRes.json();
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const answer = await startAuthentication(options);
      const result = await signIn("passkey", {
        response: JSON.stringify(answer),
        redirect: false,
      });
      if (result?.error || !result?.ok) {
        setError("That passkey wasn't recognised.");
        setLoading(false);
        return;
      }
      await afterSignIn();
    } catch (e) {
      // A user who closes the Touch ID prompt isn't an error worth shouting about.
      const name = (e as { name?: string })?.name;
      setError(
        name === "NotAllowedError" || name === "AbortError"
          ? ""
          : "Couldn't use a passkey on this device.",
      );
      setLoading(false);
    }
  }


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
        await afterSignIn();
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
            {codeStep !== "off" ? (
              /* Fallback for anyone who can't use a passkey — a borrowed
                 computer, no biometrics, or a lost phone. */
              <form
                onSubmit={(e) => {
                  if (codeStep === "ask") {
                    e.preventDefault();
                    requestCode();
                  } else {
                    submitCode(e);
                  }
                }}
                className="space-y-5"
              >
                {codeStep === "ask" ? (
                  <div className="space-y-2">
                    <Label htmlFor="code-email">Your email address</Label>
                    <Input
                      id="code-email"
                      type="email"
                      autoFocus
                      value={codeEmail}
                      onChange={(e) => setCodeEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      We&apos;ll email you a 6-digit code. It lasts 10 minutes.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="code-input">Code from your email</Label>
                    <Input
                      id="code-input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      className="text-center font-mono text-2xl tracking-[0.4em]"
                      placeholder="••••••"
                    />
                    <button
                      type="button"
                      onClick={requestCode}
                      disabled={loading}
                      className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                    >
                      Send another code
                    </button>
                  </div>
                )}

                {notice && (
                  <p className="rounded-md bg-blue-50 p-2 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                    {notice}
                  </p>
                )}
                {error && (
                  <p className="rounded-md bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={
                    loading ||
                    (codeStep === "ask" ? !codeEmail.includes("@") : code.length !== 6)
                  }
                  className="w-full rounded-xl"
                >
                  {loading
                    ? "Please wait…"
                    : codeStep === "ask"
                      ? "Email me a code"
                      : "Sign in"}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setCodeStep("off");
                    setError("");
                    setNotice("");
                    setCode("");
                  }}
                  className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Back to the usual sign in
                </button>
              </form>
            ) : (
              <>
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
            
              {/* Always offered, on any device. A passkey is the strongest
                  option available and needs no password at all. */}
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-2 text-xs text-muted-foreground">
                    or
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={signInWithPasskey}
                disabled={loading}
                className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
              >
                🔑 Sign in with passkey
              </button>
</form>
              <button
                type="button"
                onClick={() => {
                  setCodeStep("ask");
                  setError("");
                }}
                className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Can&apos;t use a passkey? Email me a sign-in code
              </button>
              </>
            )}
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

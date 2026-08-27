"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { signIn, getSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { SubmarineHeader } from "@/components/storefront/submarine-header";

/**
 * Public sign-in page for parents, carers and learners.
 *
 *   - On success, role decides destination: CLIENT → /portal, staff
 *     → /dashboard. A ?next= path wins when it's a same-site path, so
 *     someone can land straight in the course they just bought.
 *   - Banner messages drive off query flags:
 *       ?fromSetup=1   → from the password-setup flow
 *       ?registered=1  → account created but auto-signin didn't fire
 *   - Three ways in: password, passkey, or a code by email. The email
 *     code doubles as the forgotten-password route, since there's no
 *     separate reset flow.
 *
 * Wears the Submarine treatment from the Pages 1 & 3 redesign; shared
 * styles live under `.sub` in globals.css.
 */

const FIELD =
  "w-full rounded-full border-[3px] border-[#D9D2C4] bg-[#FFFCF6] px-[18px] py-4 text-base font-semibold text-[#12235B] outline-none placeholder:text-[#9AA3B8] focus:border-[#12235B] focus:bg-white";

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
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "Couldn't send a code.");
      setNotice(
        j.message ?? "If that address has an account, the code is on its way.",
      );
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
    // Somewhere specific to land — e.g. straight into the course someone
    // has just bought, rather than a list they then have to hunt through.
    // Only same-site paths: "//evil.com" and "https://…" are not paths.
    const raw = new URLSearchParams(window.location.search).get("next") ?? "";
    const next = /^\/[^/\\]/.test(raw) ? raw : "";
    window.location.href = next || (role === "CLIENT" ? "/portal" : "/dashboard");
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
      // Closing the Touch ID prompt isn't an error worth shouting about.
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
        setError("That email and password didn't match.");
        setLoading(false);
        return;
      }
      if (result?.ok) await afterSignIn();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="sub min-h-screen">
      <SubmarineHeader />

      <main className="grid lg:grid-cols-[1.1fr_1fr]">
        {/* ── Form ─────────────────────────────────────────────────── */}
        <div className="relative flex items-center justify-center overflow-hidden px-5 py-12 sm:px-14 sm:py-16 lg:justify-end">
          <div className="sub-dots pointer-events-none absolute inset-0" aria-hidden />
          <div
            className="pointer-events-none absolute -left-[100px] -top-[120px] h-[380px] w-[380px] rounded-full bg-[#FFE9A8]"
            aria-hidden
          />

          <div className="sub-edge-xl relative w-full max-w-[470px] rounded-[34px] bg-white px-7 pb-8 pt-9 sm:px-9 sm:pb-8 sm:pt-10">
            <h1 className="sub-display text-[34px] tracking-[-1px] sm:text-[42px]">
              Welcome back!
            </h1>
            <p className="mt-2 text-base font-semibold text-[#5A6785]">
              Your courses, bookings and home programmes are right where you
              left them.
            </p>

            {(fromSetup || justRegistered) && (
              <p className="mt-6 flex items-center gap-3 rounded-[18px] border-2 border-[#A9DCD7] bg-[#E7F6F4] px-4 py-3.5 text-sm font-bold text-[#0E6F68]">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full bg-[#17B0A7]"
                  aria-hidden
                />
                {fromSetup
                  ? "Password set. Sign in to continue."
                  : "Account created. Sign in to continue."}
              </p>
            )}

            {error && (
              <p className="mt-6 rounded-[18px] border-2 border-[#FBC7D7] bg-[#FFE7EE] px-4 py-3.5 text-sm font-bold text-[#B81243]">
                {error}
              </p>
            )}
            {notice && (
              <p className="mt-6 rounded-[18px] border-2 border-[#C9D8F5] bg-[#EAF1FF] px-4 py-3.5 text-sm font-bold text-[#25407F]">
                {notice}
              </p>
            )}

            {codeStep !== "off" ? (
              /* For anyone who can't use a password or a passkey — a
                 borrowed computer, no biometrics, a forgotten password. */
              <form
                className="mt-6"
                onSubmit={(e) => {
                  if (codeStep === "ask") {
                    e.preventDefault();
                    requestCode();
                  } else {
                    submitCode(e);
                  }
                }}
              >
                {codeStep === "ask" ? (
                  <>
                    <label
                      htmlFor="code-email"
                      className="mb-2 block text-sm font-extrabold"
                    >
                      Your email address
                    </label>
                    <input
                      id="code-email"
                      type="email"
                      autoFocus
                      value={codeEmail}
                      onChange={(e) => setCodeEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={FIELD}
                    />
                    <p className="mt-2 px-2 text-sm font-semibold text-[#6B7794]">
                      We&apos;ll email you a 6-digit code. It lasts 10 minutes.
                    </p>
                  </>
                ) : (
                  <>
                    <label
                      htmlFor="code-input"
                      className="mb-2 block text-sm font-extrabold"
                    >
                      Code from your email
                    </label>
                    <input
                      id="code-input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="••••••"
                      className={`${FIELD} text-center font-mono text-2xl tracking-[0.4em]`}
                    />
                    <button
                      type="button"
                      onClick={requestCode}
                      disabled={loading}
                      className="mt-2 px-2 text-sm font-extrabold text-[#E71D57] hover:underline disabled:opacity-50"
                    >
                      Send another code
                    </button>
                  </>
                )}

                <button
                  type="submit"
                  disabled={
                    loading ||
                    (codeStep === "ask" ? !codeEmail.includes("@") : code.length !== 6)
                  }
                  className="sub-display sub-edge-lg sub-press mt-6 w-full rounded-full px-6 py-4 text-xl text-white disabled:opacity-60"
                  style={{ background: "var(--sub-pink)" }}
                >
                  {loading
                    ? "Please wait…"
                    : codeStep === "ask"
                      ? "Email me a code"
                      : "Dive in"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCodeStep("off");
                    setError("");
                    setNotice("");
                    setCode("");
                  }}
                  className="mt-4 w-full text-center text-sm font-bold text-[#6B7794] hover:text-[#12235B]"
                >
                  Back to the usual sign in
                </button>
              </form>
            ) : (
              <>
                <form className="mt-6" onSubmit={handleSubmit}>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-extrabold"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={FIELD}
                  />

                  <div className="mb-2 mt-[18px] flex items-baseline justify-between gap-3">
                    <label htmlFor="password" className="text-sm font-extrabold">
                      Password
                    </label>
                    {/* No separate reset flow — a code by email is the way
                        back in, so that's what "forgot it" does. */}
                    <button
                      type="button"
                      onClick={() => {
                        setCodeStep("ask");
                        setError("");
                      }}
                      className="text-[13px] font-bold text-[#E71D57] hover:text-[#B81243]"
                    >
                      Forgot it?
                    </button>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className={FIELD}
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    className="sub-display sub-edge-lg sub-press mt-6 w-full rounded-full px-6 py-4 text-xl text-white disabled:opacity-60"
                    style={{ background: "var(--sub-pink)" }}
                  >
                    {loading ? "Signing in…" : "Dive in"}
                  </button>
                </form>

                <div className="my-6 flex items-center gap-3.5">
                  <span className="h-0.5 flex-1 bg-[#EFE6D6]" />
                  <span className="text-xs font-extrabold tracking-[1px] text-[#A2A9BB]">
                    OR
                  </span>
                  <span className="h-0.5 flex-1 bg-[#EFE6D6]" />
                </div>

                <button
                  type="button"
                  onClick={signInWithPasskey}
                  disabled={loading}
                  className="w-full rounded-full border-[3px] border-[#12235B] bg-white px-6 py-3.5 text-base font-extrabold text-[#12235B] hover:bg-[#FFF3D2] disabled:opacity-50"
                >
                  Sign in with a passkey
                </button>

                <p className="mt-4 text-center text-sm font-semibold text-[#6B7794]">
                  No passkey?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setCodeStep("ask");
                      setError("");
                    }}
                    className="font-bold text-[#E71D57] hover:text-[#B81243]"
                  >
                    Email me a sign-in code
                  </button>
                </p>
              </>
            )}

            <p className="mt-5 border-t-2 border-[#F2E9DA] pt-5 text-center text-[15px] font-bold">
              New here?{" "}
              <Link href="/register" className="text-[#E71D57] hover:text-[#B81243]">
                Create an account
              </Link>
            </p>
            <p className="mt-2 text-center text-[15px] font-semibold text-[#6B7794]">
              Or{" "}
              <Link href="/book" className="font-bold text-[#E71D57] hover:text-[#B81243]">
                book your first session
              </Link>{" "}
              without signing up.
            </p>
            <p className="mt-6 text-center">
              <Link
                href="/admin/login"
                className="text-[13px] font-bold text-[#A2A9BB] hover:text-[#12235B]"
              >
                Staff login
              </Link>
            </p>
          </div>
        </div>

        {/* ── What's behind the door ───────────────────────────────── */}
        <div className="relative flex items-center overflow-hidden bg-[#12235B] px-5 py-14 sm:px-14 sm:py-16">
          <div
            className="pointer-events-none absolute -right-[90px] -top-[90px] h-[340px] w-[340px] rounded-full"
            style={{ background: "rgba(255,201,60,.18)" }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-[70px] -left-[60px] h-[260px] w-[260px] rounded-full"
            style={{ background: "rgba(231,29,87,.28)" }}
            aria-hidden
          />
          <span
            className="sub-bubble absolute bottom-0 left-[20%] h-3.5 w-3.5 rounded-full bg-[rgba(255,255,255,.35)]"
            style={{ animationDuration: "7s" }}
            aria-hidden
          />
          <span
            className="sub-bubble absolute bottom-0 left-[62%] h-2.5 w-2.5 rounded-full bg-[rgba(255,255,255,.35)]"
            style={{ animationDuration: "8.5s", animationDelay: "1.4s" }}
            aria-hidden
          />

          <div className="relative max-w-[440px]">
            <p className="inline-block rounded-full border-[3px] border-[#0A1740] bg-[#FFC93C] px-4 py-2 text-xs font-extrabold uppercase tracking-[1.4px] text-[#12235B]">
              The training platform
            </p>
            <h2 className="sub-display mt-5 text-[32px] leading-tight tracking-[-.8px] text-white sm:text-[40px]">
              Everything for your child, in one place
            </h2>
            <p className="mb-7 mt-3 text-[17px] font-semibold leading-relaxed text-[#C6D0EA]">
              Saved across devices, so you can pick up exactly where you left
              off.
            </p>

            <div className="flex flex-col gap-3.5">
              {[
                {
                  colour: "#FFC93C",
                  title: "Courses",
                  body: "Resume modules, re-watch sessions, download handouts.",
                },
                {
                  colour: "#E71D57",
                  title: "Bookings",
                  body: "See upcoming sessions, reschedule, read your notes.",
                },
                {
                  colour: "#17B0A7",
                  title: "Home programmes",
                  body: "Your personalised plan, kept up to date by Grace.",
                },
              ].map((row) => (
                <div
                  key={row.title}
                  className="flex items-start gap-4 rounded-[22px] border-2 border-[rgba(255,255,255,.16)] bg-[rgba(255,255,255,.07)] px-5 py-4"
                >
                  <span
                    className="h-11 w-11 shrink-0 rounded-[14px]"
                    style={{ background: row.colour }}
                    aria-hidden
                  />
                  <div>
                    <p className="sub-display text-xl text-white">{row.title}</p>
                    <p className="text-[15px] font-semibold text-[#C6D0EA]">
                      {row.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <span className="rounded-full bg-[rgba(255,255,255,.12)] px-3.5 py-2 text-[13px] font-bold text-white">
                CPD-accredited
              </span>
              <span className="rounded-full bg-[rgba(255,255,255,.12)] px-3.5 py-2 text-[13px] font-bold text-white">
                OT-led · evidence-based
              </span>
            </div>
          </div>
        </div>
      </main>
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

"use client";

/**
 * Public sign-up page for parents and carers.
 *
 *   - Calls /api/auth/register to create a CLIENT-role user.
 *   - On 201, immediately calls signIn() so the family lands
 *     straight on /portal without a "now please log in" hop.
 *   - On 409 (email taken) we suggest the /login page instead.
 *
 * Wears the Submarine treatment and mirrors /login, so the pair feel
 * like two sides of the same door.
 */
import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { SubmarineHeader } from "@/components/storefront/submarine-header";

const FIELD =
  "w-full rounded-full border-[3px] border-[#D9D2C4] bg-[#FFFCF6] px-[18px] py-4 text-base font-semibold text-[#12235B] outline-none placeholder:text-[#9AA3B8] focus:border-[#12235B] focus:bg-white";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (res.status === 409) {
        setError(
          "An account with that email already exists. Try signing in instead.",
        );
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          data.error ??
            "We couldn't create your account just now. Please try again in a moment.",
        );
        return;
      }

      // Account created — drop them straight into the portal.
      const signin = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (signin?.error) {
        // The account exists but auto-sign-in didn't take — push
        // them to /login with a friendly nudge.
        router.push("/login?registered=1");
        return;
      }
      window.location.href = "/portal";
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sub min-h-screen">
      <SubmarineHeader />

      <main className="grid lg:grid-cols-[1.1fr_1fr]">
        {/* ── The form ─────────────────────────────────────────────── */}
        <div className="relative flex items-center justify-center overflow-hidden px-5 py-12 sm:px-14 sm:py-16 lg:justify-end">
          <div className="sub-dots pointer-events-none absolute inset-0" aria-hidden />
          <div
            className="pointer-events-none absolute -left-[100px] -top-[120px] h-[380px] w-[380px] rounded-full bg-[#FFE9A8]"
            aria-hidden
          />

          <div className="relative w-full max-w-[470px]">
            <h1 className="sub-display text-[36px] leading-[1.05] tracking-[-1.2px] sm:text-[46px]">
              Create your account
            </h1>
            <p className="mb-6 mt-3 text-base font-semibold text-[#5A6785]">
              Free to set up. Start with a course, book a 1:1, or save a home
              programme — all from one place.
            </p>

            <form
              onSubmit={handleSubmit}
              className="rounded-[34px] border-[3px] border-[#12235B] bg-white px-7 pb-7 pt-8 shadow-[8px_8px_0_#E71D57] sm:px-8"
            >
              {error && (
                <p className="mb-5 rounded-[18px] border-2 border-[#FBC7D7] bg-[#FFE7EE] px-4 py-3.5 text-sm font-bold text-[#B81243]">
                  {error}{" "}
                  {error.startsWith("An account") && (
                    <Link href="/login" className="underline">
                      Sign in
                    </Link>
                  )}
                </p>
              )}

              <label htmlFor="name" className="mb-2 block text-sm font-extrabold">
                Your name
              </label>
              <input
                id="name"
                name="name"
                required
                autoComplete="name"
                placeholder="Jane Smith"
                className={FIELD}
              />

              <label
                htmlFor="email"
                className="mb-2 mt-[18px] block text-sm font-extrabold"
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

              <label
                htmlFor="password"
                className="mb-2 mt-[18px] block text-sm font-extrabold"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className={FIELD}
              />
              <p className="mt-2.5 px-1 text-[13px] font-semibold text-[#6B7794]">
                Letters, numbers, or a passphrase you&apos;ll actually remember.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="sub-display sub-edge-lg sub-press mt-6 w-full rounded-full px-6 py-4 text-xl text-white disabled:opacity-60"
                style={{ background: "var(--sub-pink)" }}
              >
                {loading ? "Creating your account…" : "Create my account"}
              </button>

              <p className="mt-4 text-center text-[12.5px] font-semibold leading-relaxed text-[#8A93A8]">
                By creating an account you agree to our terms of use and the
                handling of your data as set out in our privacy notice.
              </p>
            </form>

            <p className="mt-5 text-center text-[15px] font-bold">
              Already have an account?{" "}
              <Link href="/login" className="text-[#E71D57] hover:text-[#B81243]">
                Sign in
              </Link>
            </p>
            <p className="mt-2 text-center text-[15px] font-semibold text-[#6B7794]">
              Or{" "}
              <Link
                href="/book"
                className="font-bold text-[#E71D57] hover:text-[#B81243]"
              >
                book your first session
              </Link>{" "}
              without signing up.
            </p>
          </div>
        </div>

        {/* ── What an account gets you ─────────────────────────────── */}
        <div className="relative flex items-center overflow-hidden bg-[#12235B] px-5 py-14 sm:px-14 sm:py-16">
          <div
            className="pointer-events-none absolute -right-[90px] -top-[90px] h-[340px] w-[340px] rounded-full"
            style={{ background: "rgba(255,201,60,.18)" }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-[70px] -left-[60px] h-[260px] w-[260px] rounded-full"
            style={{ background: "rgba(23,176,167,.3)" }}
            aria-hidden
          />
          <span
            className="sub-bubble absolute bottom-0 left-[30%] h-3 w-3 rounded-full bg-[rgba(255,255,255,.35)]"
            style={{ animationDuration: "7.5s" }}
            aria-hidden
          />
          <span
            className="sub-bubble absolute bottom-0 left-[70%] h-2 w-2 rounded-full bg-[rgba(255,255,255,.35)]"
            style={{ animationDuration: "9s", animationDelay: "1.8s" }}
            aria-hidden
          />

          <div className="relative max-w-[440px]">
            <p className="inline-block rounded-full border-[3px] border-[#0A1740] bg-[#17B0A7] px-4 py-2 text-xs font-extrabold uppercase tracking-[1.4px] text-white">
              Free to join
            </p>
            <h2 className="sub-display mt-5 text-[32px] leading-tight tracking-[-.8px] text-white sm:text-[40px]">
              One account, three ways to get going
            </h2>
            <p className="mb-7 mt-3 text-[17px] font-semibold leading-relaxed text-[#C6D0EA]">
              Built by paediatric OT Grace Magennis. Start small and add more as
              you go.
            </p>

            <div className="flex flex-col gap-3.5">
              {[
                {
                  colour: "#FFC93C",
                  title: "Online courses",
                  body: "Short, practical lessons at your own pace.",
                },
                {
                  colour: "#E71D57",
                  title: "1:1 sessions",
                  body: "Book a video or in-person visit, notes in one tap.",
                },
                {
                  colour: "#17B0A7",
                  title: "Home programmes",
                  body: "Personalised routines built around your child.",
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

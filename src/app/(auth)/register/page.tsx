"use client";

/**
 * Public sign-up page for parents and carers.
 *
 *   - Calls /api/auth/register to create a CLIENT-role user.
 *   - On 201, immediately calls signIn() so the family lands
 *     straight on /portal without a "now please log in" hop.
 *   - On 409 (email taken) we suggest the /login page instead.
 *
 * Layout mirrors /login so both pages feel the same on mobile.
 * Marketing reassurance (value prop + trust strip) sits next to the
 * form on wide screens to lower the "is this safe?" friction.
 */
import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Award, BookOpen, Heart, Sparkles, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";

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
    <AuthShell>
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
                Create your account
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Free to set up. Start with a course, book a 1:1, or save a home
                programme — all from one place.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600 dark:bg-red-950/50 dark:text-red-400">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className="text-sm font-medium text-foreground/80"
                  >
                    Your name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Jane Smith"
                    className="h-11 rounded-xl"
                  />
                </div>
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
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="h-11 rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Use a mix of letters, numbers, or a passphrase you can
                    remember.
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/80"
                >
                  {loading ? "Creating your account…" : "Create account"}
                </Button>

                <p className="text-center text-[11px] text-muted-foreground">
                  By creating an account you agree to our terms of use and the
                  handling of your data as set out in our privacy notice.
                </p>
              </form>
            </div>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                Sign in
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
                One account, three ways to get going
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Built by paediatric OT Grace Magennis. Free to join — start with
                a small course or a 1:1 session and add more as you go.
              </p>

              <ul className="mt-5 space-y-4">
                <li className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BookOpen className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Online courses</p>
                    <p className="text-xs text-muted-foreground">
                      Short, practical lessons you can do at your own pace.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Video className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">1:1 sessions</p>
                    <p className="text-xs text-muted-foreground">
                      Book a video or in-person visit with Grace, see notes in
                      one tap.
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
                      Personalised at-home routines and activity ideas built
                      around your child.
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
    </AuthShell>
  );
}

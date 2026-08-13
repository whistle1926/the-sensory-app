"use client";

/**
 * The checkout page.
 *
 * Replaces a pop-up that had room for a price and nothing else. Here the
 * buyer sees the order before they pay, can add a second course with one
 * tick, and can switch to euro when they hold a euro account.
 *
 * Everything is one payment: the add-ons ride along on the same Fire request.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Check, Loader2, Lock, Plus } from "lucide-react";
import {
  CURRENCY_SYMBOL,
  formatPrice,
  priceIn,
  type Currency,
} from "@/lib/course-currency";

interface Item {
  id: string;
  title: string;
  blurb: string;
  price: number;
  priceEur?: number | null;
  thumbnailUrl?: string | null;
}

interface Addon extends Item {
  /** Benefit-led line written for this moment. */
  headline: string;
  /** A few concrete things they'd get. */
  features: string[];
  duration: string;
}

export function CheckoutView({
  course,
  addons,
}: {
  course: Item & { slug: string; duration: string };
  addons: Addon[];
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currency, setCurrency] = useState<Currency>("GBP");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const signedIn = status === "authenticated" && !!session?.user;

  // A euro option only exists if everything in the basket has a euro price —
  // otherwise the total couldn't be raised in one currency.
  const chosenAddons = useMemo(
    () => addons.filter((a) => picked.has(a.id)),
    [addons, picked],
  );
  const basket = useMemo(() => [course, ...chosenAddons], [course, chosenAddons]);
  const euroPossible = basket.every((i) => typeof i.priceEur === "number");

  useEffect(() => {
    if (!euroPossible && currency === "EUR") setCurrency("GBP");
  }, [euroPossible, currency]);

  const lineTotal = (i: Item) => priceIn(i, currency) ?? i.price;
  const total = basket.reduce((sum, i) => sum + lineTotal(i), 0);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setError("");
    if (!signedIn && (!name.trim() || !email.trim())) {
      setError("Please enter your name and email so we know where to send it.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/courses/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          addonCourseIds: [...picked],
          currency,
          ...(signedIn ? {} : { name: name.trim(), email: email.trim() }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl as string;
        return;
      }
      if (data.redirect) {
        router.push(data.redirect as string);
        return;
      }
      if (data.checkEmail) {
        router.push(`/courses/thanks?free=1`);
        return;
      }
      router.push(`/portal/training/${course.id}`);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const field =
    "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30";

  return (
    /* Top of the page is kept deliberately tight. The add-ons are the part
       most people never scroll to, so the heading, the back link and the
       "what you're buying" row are compressed to lift the first offer — and
       its Add button — above the fold on a laptop. */
    <div className="mx-auto max-w-5xl px-4 py-5 sm:py-7">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          Checkout
        </h1>
        <Link
          href={`/courses/${course.slug}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to the course
        </Link>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* ── Left: what you're buying, and what else you could add ── */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              {course.thumbnailUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={course.thumbnailUrl}
                  alt=""
                  className="h-12 w-20 shrink-0 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Your order
                </p>
                <p className="truncate font-bold leading-snug">{course.title}</p>
              </div>
              <p className="shrink-0 font-bold">
                {formatPrice(lineTotal(course), currency)}
              </p>
            </div>
          </section>

          {addons.length > 0 && (
            <section className="rounded-2xl border-2 border-primary/30 bg-primary/[0.03] p-4">
              <h2 className="text-base font-black">
                Parents usually add these too
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Same order, one payment — and yours to keep just the same.
              </p>
              <div className="mt-3 space-y-3">
                {addons.map((a) => {
                  const on = picked.has(a.id);
                  const price = formatPrice(priceIn(a, currency) ?? a.price, currency);
                  return (
                    <div
                      key={a.id}
                      className={`overflow-hidden rounded-2xl border-2 bg-card transition ${
                        on ? "border-primary shadow-[var(--shadow-sm)]" : "border-border"
                      }`}
                    >
                      <div className="flex gap-4 p-4">
                        {a.thumbnailUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={a.thumbnailUrl}
                            alt=""
                            className="hidden h-28 w-40 shrink-0 rounded-xl border border-border object-cover sm:block"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          {a.headline && (
                            <p className="text-base font-black leading-snug">
                              {a.headline}
                            </p>
                          )}
                          <p
                            className={
                              a.headline
                                ? "mt-0.5 text-xs font-semibold uppercase tracking-wider text-primary"
                                : "text-base font-black leading-snug"
                            }
                          >
                            {a.title}
                          </p>
                          {a.blurb && a.blurb !== a.headline && (
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                              {a.blurb}
                            </p>
                          )}
                          {a.features.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {a.features.map((f, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-1.5 text-sm text-muted-foreground"
                                >
                                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggle(a.id)}
                        className={`flex w-full items-center justify-between gap-3 border-t px-4 py-3 text-left transition ${
                          on
                            ? "border-primary/30 bg-primary/10"
                            : "border-border bg-muted/30 hover:bg-muted/60"
                        }`}
                      >
                        <span className="flex items-center gap-2 text-sm font-bold">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                              on
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input bg-background"
                            }`}
                          >
                            {on ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Plus className="h-3.5 w-3.5 opacity-50" />
                            )}
                          </span>
                          {on ? "Added to your order" : `Add for ${price}`}
                        </span>
                        <span className="text-sm font-black">{price}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold">Your details</h2>
            {signedIn ? (
              <p className="mt-3 rounded-xl bg-muted/40 p-3 text-sm">
                <span className="font-semibold">{session?.user?.email}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Signed in — we&apos;ll add this to your account.
                </span>
              </p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  className={field}
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  className={field}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  We&apos;ll email your receipt and a link to set a password, so
                  you can come back to the course any time.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* ── Right: the total and the button ───────────────────────── */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
            <h2 className="text-sm font-bold">Summary</h2>

            <div className="mt-3 space-y-2 text-sm">
              {basket.map((i) => (
                <div key={i.id} className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-muted-foreground">{i.title}</span>
                  <span className="shrink-0 font-semibold">
                    {formatPrice(lineTotal(i), currency)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="font-bold">Total</span>
              <span className="text-2xl font-black">{formatPrice(total, currency)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              One-time payment. Lifetime access, no subscription.
            </p>

            {euroPossible && (
              <div className="mt-4">
                <p className="mb-1.5 text-xs text-muted-foreground">
                  Paying from an Irish (euro) account? A sterling request
                  can&apos;t be paid from a euro account.
                </p>
                <div className="inline-flex rounded-lg border border-border p-0.5">
                  {(["GBP", "EUR"] as Currency[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCurrency(c)}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                        currency === c
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Pay in {CURRENCY_SYMBOL[c]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-xl border border-red-500/40 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {total === 0 ? "Enrol now" : `Pay ${formatPrice(total, currency)}`}
            </button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              Secure checkout via FireBuddy
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

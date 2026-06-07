"use client";

import { Suspense, useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
  ChevronRight,
  Video,
  Clock,
  Globe,
  Users,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowLeft,
  MapPin,
} from "lucide-react";
import { StorefrontHeader } from "@/components/courses/storefront-header";
import { DEPOSIT_SERVICES, type TermsClause } from "@/lib/booking-terms";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

interface ServiceCatalogueRow {
  /** Maps to BookingService.slug on the API side; kept as `id` here
   * because the rest of the page already reasons in terms of `id`. */
  id: string;
  title: string;
  duration: string;
  durationMins: number;
  price: number; // pence
  priceLabel: string;
  description: string;
  category: string;
  /** "in_person" | "online" | "home" \u2014 drives the badge wording. */
  mode: string;
  /** Town/venue for in-person services (e.g. "Armagh"). */
  locationLabel: string | null;
  /** Display name of the associate who runs this service, if any. */
  ownerName: string | null;
  /** Picked at render time \u2014 every card gets a consistent icon based on
   * a stable hash of the slug so it doesn't change between visits. */
  icon: typeof Video;
  colour: string;
}

// Stable icon + colour palettes \u2014 both keyed off the slug so a given
// service always renders with the same look.
const ICON_PALETTE = [Video, Clock, Users, Globe];
const COLOUR_PALETTE = [
  "oklch(0.55 0.20 264)",
  "oklch(0.60 0.18 170)",
  "oklch(0.65 0.17 50)",
  "oklch(0.55 0.20 310)",
  "oklch(0.55 0.20 30)",
  "oklch(0.50 0.18 200)",
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function adaptService(
  row: {
    slug: string;
    title: string;
    description: string;
    tagline: string | null;
    category: string;
    pricePence: number;
    durationLabel: string;
    durationMinutes: number;
    mode?: string;
    locationLabel?: string | null;
    ownerName?: string | null;
  },
): ServiceCatalogueRow {
  const h = hashCode(row.slug);
  return {
    id: row.slug,
    title: row.title,
    duration: row.durationLabel || `${row.durationMinutes} minutes`,
    durationMins: row.durationMinutes,
    price: row.pricePence,
    priceLabel: row.pricePence === 0 ? "Free" : `\u00a3${row.pricePence / 100}`,
    description: row.description || row.tagline || "",
    category: row.category || "",
    mode: row.mode || "in_person",
    locationLabel: row.locationLabel ?? null,
    ownerName: row.ownerName ?? null,
    icon: ICON_PALETTE[h % ICON_PALETTE.length],
    colour: COLOUR_PALETTE[h % COLOUR_PALETTE.length],
  };
}

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getWeekStart(d: Date) {
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day;
  const ws = new Date(d);
  ws.setDate(diff);
  ws.setHours(0, 0, 0, 0);
  return ws;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

type Step = "service" | "datetime" | "details" | "confirmed";

/**
 * Next.js 15 requires anything that calls `useSearchParams()` to live
 * inside a Suspense boundary, otherwise prerender bails out. The page
 * wrapper handles that — `BookingPageInner` holds the actual UI.
 */
export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background">
          <div className="mx-auto max-w-5xl p-10 text-center text-sm text-muted-foreground">
            Loading booking…
          </div>
        </div>
      }
    >
      <BookingPageInner />
    </Suspense>
  );
}

function BookingPageInner() {
  const today = useMemo(() => new Date(), []);
  const { data: session } = useSession();
  const isClient = session?.user?.role === "CLIENT";

  const [step, setStep] = useState<Step>("service");
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Live catalogue from /api/booking-services. Empty array while
  // loading — the service-picker step renders a small spinner in that
  // window.
  const [services, setServices] = useState<ServiceCatalogueRow[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);

  // Deep-link support — /book/[slug] forwards to /book?service=<slug>
  // (and /book/[slug]'s landing CTA does the same). When the catalogue
  // loads we honour the param by auto-selecting that service and
  // skipping straight to step 2 (calendar).
  const searchParams = useSearchParams();
  const preselectSlug = searchParams.get("service");

  useEffect(() => {
    fetch("/api/booking-services")
      .then((r) => r.json())
      .then((data: unknown[]) => {
        if (Array.isArray(data)) {
          const adapted = data.map((d) =>
            adaptService(d as Parameters<typeof adaptService>[0]),
          );
          setServices(adapted);
          // Auto-advance only if the preselect slug actually exists in
          // the catalogue — guards against stale ad links pointing at
          // archived services.
          if (
            preselectSlug &&
            adapted.some((s) => s.id === preselectSlug)
          ) {
            setSelectedService(preselectSlug);
            setStep("datetime");
          }
        }
        setCatalogueLoading(false);
      })
      .catch(() => setCatalogueLoading(false));
  }, [preselectSlug]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [accountCreated, setAccountCreated] = useState(false);

  // T&C consent — one boolean per applicable clause id. Submit blocks
  // until every applicable clause is ticked.
  const [agreedClauses, setAgreedClauses] = useState<Record<string, boolean>>({});

  // Live terms (version + clauses) fetched from /api/booking-terms so
  // admin edits show up without redeploy. Falls back to an empty list
  // if the fetch fails — the API route still validates server-side, so
  // a misconfigured DB won't let a no-tick submission through.
  const [terms, setTerms] = useState<{
    version: string;
    clauses: TermsClause[];
  } | null>(null);
  useEffect(() => {
    fetch("/api/booking-terms")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setTerms(data))
      .catch(() => {});
  }, []);

  // Computed available slots per date { "2026-04-07": ["09:00","09:30",...], ... }
  const [computedSlots, setComputedSlots] = useState<Record<string, string[]>>({});
  const [slotsLoaded, setSlotsLoaded] = useState(false);

  const service = services.find((s) => s.id === selectedService);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Fetch computed availability for the visible week, scoped to the
  // chosen service so parents only see that service's days/times (e.g.
  // online consults on Wed/Fri, clinics on Tue/Thu, a monthly Armagh
  // clinic on its specific dates).
  const fetchSlots = useCallback(async () => {
    const from = weekDays[0].toISOString().split("T")[0];
    const to = weekDays[6].toISOString().split("T")[0];
    const serviceParam = selectedService
      ? `&service=${encodeURIComponent(selectedService)}`
      : "";
    try {
      const res = await fetch(
        `/api/availability?from=${from}&to=${to}${serviceParam}`,
      );
      if (res.ok) {
        const data = await res.json();
        setComputedSlots((prev) => ({ ...prev, ...data }));
        setSlotsLoaded(true);
      }
    } catch {
      // silent
    }
  }, [weekDays, selectedService]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Slots differ per service — wipe the cache when the chosen service
  // changes so stale slots from a previously-viewed service can't leak
  // into the new one's calendar.
  useEffect(() => {
    setComputedSlots({});
    setSlotsLoaded(false);
  }, [selectedService]);

  // Get available times for a selected date
  function getAvailableTimes(date: Date) {
    const dateKey = date.toISOString().split("T")[0];
    const slots = computedSlots[dateKey];

    // Not yet loaded — return null to show all (backward compat)
    if (!slotsLoaded) return null;

    return slots || [];
  }

  // T&C clauses applicable to the chosen service (deposit clause only
  // shows for services in DEPOSIT_SERVICES). Pulled from the live admin
  // editable terms (`/api/booking-terms`).
  const applicableClauses = useMemo(() => {
    if (!service || !terms) return [] as TermsClause[];
    const showDeposit = service.id in DEPOSIT_SERVICES;
    return terms.clauses.filter((c) => !c.depositOnly || showDeposit);
  }, [service, terms]);
  const allAgreed =
    applicableClauses.length > 0 &&
    applicableClauses.every((c) => agreedClauses[c.id]);

  /* ------ Submit booking ------ */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!service || !selectedDate || !selectedTime) return;
    if (!allAgreed) {
      setSubmitError("Please tick all of the boxes to agree to our terms.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: service.id,
          date: selectedDate.toISOString(),
          time: selectedTime,
          duration: service.duration,
          price: service.price,
          clientName: name,
          clientEmail: email,
          clientPhone: phone || undefined,
          notes: notes || undefined,
          acceptedTermsVersion: terms?.version ?? "",
          acceptedClauses: applicableClauses.map((c) => c.id),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.accountCreated) setAccountCreated(true);
        if (data.paymentUrl) {
          // Redirect to FireBuddy payment page
          window.location.href = data.paymentUrl;
          return;
        }
        setStep("confirmed");
      } else {
        const err = await res.json();
        setSubmitError(err.error || "Something went wrong");
      }
    } catch {
      setSubmitError("Network error. Please try again.");
    }

    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <StorefrontHeader />

      {/* Portal shortcut banner — only shown to signed-in CLIENTs so they
          can pop back to their portal surface without losing the browse. */}
      {isClient && (
        <div className="border-b border-border/50 bg-primary/5">
          <div className="mx-auto flex h-10 max-w-5xl items-center justify-end px-4 sm:px-6">
            <Link
              href="/portal"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to your portal
            </Link>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* ---- Progress indicator (hidden on the confirmation screen) ---- */}
        {step !== "confirmed" && (
          <div className="mx-auto mb-8 max-w-lg">
            <ol className="flex items-center gap-2 text-xs font-semibold">
              {(
                [
                  { key: "service", label: "Service" },
                  { key: "datetime", label: "Date & time" },
                  { key: "details", label: "Your details" },
                ] as const
              ).map((s, i, arr) => {
                const currentIdx = arr.findIndex((x) => x.key === step);
                const thisIdx = i;
                const state =
                  thisIdx < currentIdx
                    ? "done"
                    : thisIdx === currentIdx
                      ? "current"
                      : "upcoming";
                return (
                  <li key={s.key} className="flex flex-1 items-center gap-2">
                    <span
                      className={
                        state === "done"
                          ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
                          : state === "current"
                            ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground ring-4 ring-primary/20"
                            : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground"
                      }
                    >
                      {state === "done" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span
                      className={
                        state === "upcoming"
                          ? "text-muted-foreground hidden sm:inline"
                          : "text-foreground hidden sm:inline"
                      }
                    >
                      {s.label}
                    </span>
                    {i < arr.length - 1 && (
                      <span
                        className={
                          state === "done"
                            ? "h-px flex-1 bg-primary"
                            : "h-px flex-1 bg-border"
                        }
                        aria-hidden
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* ------ STEP: SERVICE ------ */}
        {step === "service" && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight">
                Book a Session
              </h1>
              <p className="mt-2 text-muted-foreground">
                Select a service to get started
              </p>
            </div>

            {catalogueLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading services…
              </div>
            ) : services.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center">
                <p className="font-semibold">No services published yet.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Please contact us directly to arrange a booking.
                </p>
              </div>
            ) : (
              <ServicePicker
                services={services}
                selectedService={selectedService}
                onSelect={setSelectedService}
              />
            )}

            <div className="flex justify-center">
              <Button
                onClick={() => selectedService && setStep("datetime")}
                disabled={!selectedService}
                className="h-11 rounded-xl px-8"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* ------ STEP: DATE / TIME ------ */}
        {step === "datetime" && (
          <div className="space-y-6">
            <button
              onClick={() => setStep("service")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to services
            </button>

            {service && (
              <div className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: service.colour }}
                >
                  <service.icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{service.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {service.duration} &middot; {service.priceLabel}
                  </p>
                </div>
              </div>
            )}

            <div>
              <h2 className="text-xl font-bold">Choose a date and time</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                All times shown in your local timezone. Sessions are held over
                secure video call — you&apos;ll receive a link in your
                confirmation email.
              </p>
            </div>

            {/* Week navigation */}
            <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)] overflow-hidden">
              {/* Week header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <button
                  onClick={() => setWeekStart(addDays(weekStart, -7))}
                  className="rounded-lg p-1.5 hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm font-semibold">
                  {weekStart.toLocaleDateString("en-GB", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <button
                  onClick={() => setWeekStart(addDays(weekStart, 7))}
                  className="rounded-lg p-1.5 hover:bg-muted transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* Day selector row */}
              <div className="grid grid-cols-7 border-b border-border">
                {weekDays.map((day, i) => {
                  const isToday = isSameDay(day, today);
                  const isPast =
                    day < today && !isSameDay(day, today);
                  const isSelected =
                    selectedDate && isSameDay(day, selectedDate);
                  const isWeekend = i === 0 || i === 6;
                  // Once the server-computed slot map is loaded, reflect
                  // "no slots on this day" in the strip so people don't
                  // click into empty days. Before it loads, treat every
                  // non-weekend weekday as potentially available.
                  const daySlots = getAvailableTimes(day);
                  const hasLoadedSlots = slotsLoaded;
                  const isEmpty =
                    hasLoadedSlots &&
                    Array.isArray(daySlots) &&
                    daySlots.length === 0;
                  const disabled = isPast || isWeekend || isEmpty;

                  return (
                    <button
                      key={i}
                      disabled={disabled}
                      onClick={() => {
                        setSelectedDate(day);
                        setSelectedTime(null);
                      }}
                      title={
                        isEmpty && !isPast && !isWeekend
                          ? "No availability"
                          : undefined
                      }
                      className={`flex flex-col items-center gap-1 py-3 text-center transition-colors ${
                        disabled
                          ? "cursor-not-allowed opacity-30"
                          : "hover:bg-muted/50"
                      } ${isSelected ? "bg-primary/5" : ""}`}
                    >
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {DAY_NAMES[i]}
                      </span>
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                          isSelected
                            ? "bg-primary text-white shadow-[var(--shadow-glow)]"
                            : isToday
                              ? "ring-2 ring-primary/30"
                              : ""
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      {isEmpty && !isPast && !isWeekend && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Full
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Time grid */}
              <div className="p-4">
                {!selectedDate ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Select a day above to see available times
                  </p>
                ) : (() => {
                  const times = getAvailableTimes(selectedDate);
                  // times === null means no availability configured, show all slots
                  const showAll = times === null;
                  const allTimes = showAll
                    ? HOURS.map((h) => [`${String(h).padStart(2, "0")}:00`, `${String(h).padStart(2, "0")}:30`]).flat()
                    : times;

                  return (
                    <div>
                      <p className="mb-3 text-sm font-medium text-muted-foreground">
                        {DAY_FULL[selectedDate.getDay()]}{" "}
                        {selectedDate.getDate()}{" "}
                        {selectedDate.toLocaleDateString("en-GB", {
                          month: "long",
                        })}
                      </p>
                      {allTimes.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          No available times on this day
                        </p>
                      ) : (
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                          {allTimes.map((time) => {
                            const isChosen = selectedTime === time;
                            return (
                              <button
                                key={time}
                                onClick={() => setSelectedTime(time)}
                                className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                                  isChosen
                                    ? "bg-primary text-white shadow-[var(--shadow-glow)]"
                                    : "bg-muted/50 text-foreground hover:bg-muted"
                                }`}
                              >
                                {time}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                onClick={() =>
                  selectedDate && selectedTime && setStep("details")
                }
                disabled={!selectedDate || !selectedTime}
                className="h-11 rounded-xl px-8"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* ------ STEP: DETAILS ------ */}
        {step === "details" && (
          <div className="mx-auto max-w-lg space-y-6">
            <button
              onClick={() => setStep("datetime")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to calendar
            </button>

            {/* Summary */}
            {service && selectedDate && selectedTime && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Booking Summary
                </h3>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service</span>
                    <span className="font-medium">{service.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium">
                      {formatDate(selectedDate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time</span>
                    <span className="font-medium">{selectedTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium">{service.duration}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="font-semibold">Total</span>
                    <span className="text-lg font-bold text-primary">
                      {service.priceLabel}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <h2 className="text-xl font-bold">Your details</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bookName">Full Name *</Label>
                <Input
                  id="bookName"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bookEmail">Email Address *</Label>
                <Input
                  id="bookEmail"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bookPhone">Phone Number</Label>
                <Input
                  id="bookPhone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Optional"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bookNotes">
                  Additional Notes
                </Label>
                <textarea
                  id="bookNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any relevant information about your child or concerns..."
                  rows={3}
                  className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* ------- Terms & Conditions ------- */}
              <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Terms &amp; Conditions
                  </h3>
                  {terms?.version && (
                    <span className="text-[10px] text-muted-foreground">
                      v{terms.version}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Please read each clause and tick to confirm you agree. A copy
                  is included in the confirmation email for your records.
                </p>
                {applicableClauses.map((c) => {
                  const checked = Boolean(agreedClauses[c.id]);
                  return (
                    <label
                      key={c.id}
                      htmlFor={`tc-${c.id}`}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3 transition hover:border-primary/40"
                    >
                      <input
                        id={`tc-${c.id}`}
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setAgreedClauses((prev) => ({
                            ...prev,
                            [c.id]: e.target.checked,
                          }))
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="flex-1">
                        <span className="block text-sm font-semibold">
                          {c.heading}
                          {c.id === "deposit" && service && DEPOSIT_SERVICES[service.id] && (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              ({DEPOSIT_SERVICES[service.id].label} non-refundable)
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                          {c.body}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>

              {submitError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {submitError}
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || !name || !email || !allAgreed}
                className="h-11 w-full rounded-xl"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Booking...
                  </>
                ) : (
                  `Confirm Booking \u2014 ${service?.priceLabel}`
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                You&apos;ll receive a confirmation email with a secure payment
                link. Your slot is held for you until payment is completed.
              </p>
            </form>
          </div>
        )}

        {/* ------ STEP: CONFIRMED ------ */}
        {step === "confirmed" && (
          <div className="mx-auto max-w-md space-y-6 py-12 text-center">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full shadow-[var(--shadow-glow)]"
              style={{ background: "var(--gradient-primary)" }}
            >
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Booking Confirmed</h1>
            <p className="text-muted-foreground">
              Thank you, {name}! Your booking has been received. A confirmation
              email with payment details will be sent to{" "}
              <span className="font-medium text-foreground">{email}</span>.
            </p>

            {service && selectedDate && selectedTime && (
              <div className="rounded-2xl border border-border bg-card p-5 text-left shadow-[var(--shadow-sm)]">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service</span>
                    <span className="font-medium">{service.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium">
                      {formatDate(selectedDate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time</span>
                    <span className="font-medium">{selectedTime}</span>
                  </div>
                </div>
              </div>
            )}

            {accountCreated && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-left text-sm">
                <p className="font-medium text-foreground">Your account is ready</p>
                <p className="mt-1 text-muted-foreground">
                  We&rsquo;ve created an account so you can manage this booking. Check your email for a link to set your password.
                </p>
              </div>
            )}

            <Button
              onClick={() => {
                setStep("service");
                setSelectedService(null);
                setSelectedDate(null);
                setSelectedTime(null);
                setName("");
                setEmail("");
                setPhone("");
                setNotes("");
              }}
              variant="outline"
              className="rounded-xl"
            >
              Book another session
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        <p>
          The Sensory Submarine &middot; Occupational Therapy Services &middot;
          Northern Ireland
        </p>
      </footer>
    </div>
  );
}

/**
 * Service picker for step 1. Groups cards by `category` so the parent
 * services don't sit alongside the schools ones — keeps the choice
 * scannable when there are 10+ options.
 */
function ServicePicker({
  services,
  selectedService,
  onSelect,
}: {
  services: ServiceCatalogueRow[];
  selectedService: string | null;
  onSelect: (id: string) => void;
}) {
  // Preserve catalogue order within each category. "" sorts last.
  const grouped = new Map<string, ServiceCatalogueRow[]>();
  for (const s of services) {
    const k = s.category || "Other";
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(s);
  }
  const groups = Array.from(grouped.entries());

  return (
    <div className="space-y-8">
      {groups.map(([category, items]) => (
        <div key={category}>
          {groups.length > 1 && (
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {category}
            </h2>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((s) => {
              const Icon = s.icon;
              const isSelected = selectedService === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className={`group relative rounded-2xl border-2 bg-card p-5 text-left shadow-[var(--shadow-sm)] card-lift ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute right-3 top-3">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-[var(--shadow-glow)]"
                      style={{ backgroundColor: s.colour }}
                    >
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between pr-6">
                        <h3 className="font-semibold">{s.title}</h3>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{s.duration}</span>
                        <span className="text-border">|</span>
                        <span className="font-semibold text-primary">
                          {s.priceLabel}
                        </span>
                      </div>
                      {/* Mode / location / associate badges so a parent
                          can tell an online consult from an Armagh clinic
                          at a glance, and see who they'll be seeing. */}
                      {(s.mode === "online" ||
                        s.locationLabel ||
                        s.ownerName) && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {s.mode === "online" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                              <Globe className="h-3 w-3" />
                              Online
                            </span>
                          )}
                          {s.mode === "home" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              Home visit
                            </span>
                          )}
                          {s.locationLabel && s.mode !== "online" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {s.locationLabel}
                            </span>
                          )}
                          {s.ownerName && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              with {s.ownerName}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground line-clamp-4">
                        {s.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

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
import { localDateKey } from "@/lib/date-key";

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
  /** Therapist profile (shown on the location step). */
  ownerPhotoUrl: string | null;
  ownerBio: string | null;
  ownerPhone: string | null;
  /** Dates the client picks in one booking. 1/1 = a single appointment;
   * a block (e.g. 2/5) is charged `price` PER session. */
  minSessions: number;
  maxSessions: number;
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
    ownerPhotoUrl?: string | null;
    ownerBio?: string | null;
    ownerPhone?: string | null;
    minSessions?: number;
    maxSessions?: number;
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
    ownerPhotoUrl: row.ownerPhotoUrl ?? null,
    ownerBio: row.ownerBio ?? null,
    ownerPhone: row.ownerPhone ?? null,
    minSessions: Math.max(1, row.minSessions ?? 1),
    maxSessions: Math.max(1, row.maxSessions ?? 1),
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

type Step = "service" | "location" | "datetime" | "details" | "confirmed";

/** A service is a face-to-face clinic assessment if it's an in-person
 * service tagged with a town/venue. These are grouped under one
 * "Face to Face OT Assessment" card and split into location tabs. */
function isLocationAssessment(s: ServiceCatalogueRow): boolean {
  return s.mode === "in_person" && Boolean(s.locationLabel);
}

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

  // ── Block bookings ───────────────────────────────────────────────
  // A block service asks for several dates in one go (min..max), priced
  // per session. `chosenSlots` holds them in pick order; a single-session
  // service just ends up with one entry.
  const maxSessions = service?.maxSessions ?? 1;
  const minSessions = service?.minSessions ?? 1;
  const isBlock = maxSessions > 1;
  const [chosenSlots, setChosenSlots] = useState<
    Array<{ date: Date; time: string }>
  >([]);

  // Switching service invalidates any picks.
  useEffect(() => {
    setChosenSlots([]);
  }, [selectedService]);

  const slotKey = (d: Date, t: string) => `${localDateKey(d)}_${t}`;
  const isSlotChosen = (d: Date, t: string) =>
    chosenSlots.some((s) => slotKey(s.date, s.time) === slotKey(d, t));

  /** Toggle a slot for a block; for a single service just replace it. */
  function toggleSlot(d: Date, t: string) {
    if (!isBlock) {
      setChosenSlots([{ date: d, time: t }]);
      return;
    }
    setChosenSlots((prev) => {
      const key = slotKey(d, t);
      const existing = prev.find((s) => slotKey(s.date, s.time) === key);
      if (existing) return prev.filter((s) => slotKey(s.date, s.time) !== key);
      if (prev.length >= maxSessions) return prev; // at the cap
      return [...prev, { date: d, time: t }].sort(
        (a, b) =>
          a.date.getTime() - b.date.getTime() || a.time.localeCompare(b.time),
      );
    });
  }

  // What the client will actually pay — per-session price × sessions.
  const sessionCount = chosenSlots.length;
  const totalPence = (service?.price ?? 0) * Math.max(1, sessionCount);
  const totalLabel =
    service?.price === 0 ? "Free" : `£${(totalPence / 100).toFixed(2)}`;

  // Split the catalogue: the face-to-face clinic assessments are pulled
  // out and shown under one prominent "Face to Face OT Assessment" card
  // (most-requested service, pinned top), then chosen by location. Every
  // other service renders as a normal card.
  const locationServices = useMemo(
    () => services.filter(isLocationAssessment),
    [services],
  );
  const otherServices = useMemo(
    () => services.filter((s) => !isLocationAssessment(s)),
    [services],
  );
  const assessmentPriceLabel =
    locationServices[0]?.priceLabel ?? "";

  // Picking a service jumps straight into the booking flow (date & time)
  // — no separate "Continue" click. Parents told us they kept having to
  // scroll to find the button. One service at a time, so selecting it is
  // an unambiguous "let's book this".
  const chooseService = useCallback((id: string) => {
    setSelectedService(id);
    setStep("datetime");
  }, []);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Fetch computed availability for the visible week, scoped to the
  // chosen service so parents only see that service's days/times (e.g.
  // online consults on Wed/Fri, clinics on Tue/Thu, a monthly Armagh
  // clinic on its specific dates).
  const fetchSlots = useCallback(async () => {
    const from = localDateKey(weekDays[0]);
    const to = localDateKey(weekDays[6]);
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
    const dateKey = localDateKey(date);
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
    if (!service || chosenSlots.length === 0) return;
    if (chosenSlots.length < minSessions) {
      setSubmitError(
        `Please choose ${minSessions} appointment${minSessions === 1 ? "" : "s"}.`,
      );
      return;
    }
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
          // Every appointment being booked — one for a normal service,
          // 2-5 for a block. The server re-checks the count, the price
          // and each slot's availability.
          slots: chosenSlots.map((s) => ({
            date: s.date.toISOString(),
            time: s.time,
          })),
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
                // The location-picker is part of choosing a service, so it
                // shares the "Service" progress dot.
                const progressStep = step === "location" ? "service" : step;
                const currentIdx = arr.findIndex((x) => x.key === progressStep);
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
              <div className="space-y-8">
                {/* Most-requested: Face to Face OT Assessment, pinned to the
                    top. One card that opens the location picker. */}
                {locationServices.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep("location")}
                    className="group relative w-full overflow-hidden rounded-2xl border-2 border-primary/30 bg-primary/[0.03] p-5 text-left shadow-[var(--shadow-sm)] card-lift hover:border-primary"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-[var(--shadow-glow)]"
                        style={{ backgroundColor: "oklch(0.55 0.20 264)" }}
                      >
                        <MapPin className="h-6 w-6 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="mb-1.5 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                          Most requested
                        </span>
                        <h3 className="text-lg font-bold">
                          Face to Face OT Assessment
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {assessmentPriceLabel && (
                            <span className="font-semibold text-primary">
                              {assessmentPriceLabel}
                            </span>
                          )}
                          <span className="text-border">|</span>
                          <span>
                            {locationServices.length} clinic location
                            {locationServices.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          A full in-person occupational therapy assessment.
                          Choose the clinic nearest you to see available dates.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {locationServices.map((s) => (
                            <span
                              key={s.id}
                              className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-foreground shadow-[var(--shadow-sm)]"
                            >
                              <MapPin className="h-3 w-3 text-primary" />
                              {s.locationLabel}
                            </span>
                          ))}
                        </div>
                        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                          Choose a location
                          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </button>
                )}

                {otherServices.length > 0 && (
                  <ServicePicker
                    services={otherServices}
                    onSelect={chooseService}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ------ STEP: LOCATION (clinic tabs for the F2F assessment) ------ */}
        {step === "location" && (
          <div className="space-y-6">
            <button
              onClick={() => setStep("service")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to services
            </button>

            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight">
                Face to Face OT Assessment
              </h1>
              <p className="mt-2 text-muted-foreground">
                Choose your nearest clinic location to see available dates
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {locationServices.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => chooseService(s.id)}
                  className="group flex flex-col rounded-2xl border-2 border-border bg-card p-5 text-left shadow-[var(--shadow-sm)] card-lift hover:border-primary"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-[var(--shadow-glow)]"
                      style={{ backgroundColor: s.colour }}
                    >
                      <MapPin className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">
                        {s.locationLabel ?? s.title}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{s.duration}</span>
                        <span className="text-border">|</span>
                        <span className="font-semibold text-primary">
                          {s.priceLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Therapist profile — who you'll be seeing at this clinic. */}
                  <TherapistMini service={s} />

                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    See dates
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ------ STEP: DATE / TIME ------ */}
        {step === "datetime" && (
          <div className="space-y-6">
            <button
              onClick={() =>
                setStep(
                  service && isLocationAssessment(service)
                    ? "location"
                    : "service",
                )
              }
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {service && isLocationAssessment(service)
                ? "Back to locations"
                : "Back to services"}
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
                            const chosen = isSlotChosen(selectedDate, time);
                            const atCap =
                              isBlock && !chosen && sessionCount >= maxSessions;
                            return (
                              <button
                                key={time}
                                disabled={atCap}
                                title={
                                  atCap
                                    ? `You've picked the maximum of ${maxSessions} sessions`
                                    : undefined
                                }
                                onClick={() => {
                                  toggleSlot(selectedDate, time);
                                  // A single appointment goes straight on to
                                  // the details form (parents kept hunting
                                  // for a Continue button). A block needs
                                  // several dates, so we stay put until
                                  // they've picked enough.
                                  if (!isBlock) {
                                    setSelectedTime(time);
                                    setStep("details");
                                  }
                                }}
                                className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                                  chosen
                                    ? "bg-primary text-white shadow-[var(--shadow-glow)]"
                                    : atCap
                                      ? "cursor-not-allowed bg-muted/30 text-muted-foreground/40"
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

            {/* Block bookings: running list of the dates picked so far +
                the live total, then Continue once they've hit the minimum.
                (A single appointment jumps straight to the details form,
                so this never shows for one.) */}
            {isBlock && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
                <p className="text-sm font-semibold">
                  Choose {minSessions}
                  {maxSessions > minSessions ? `–${maxSessions}` : ""}{" "}
                  appointments
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pick a day above, then tap a time. Repeat until you&apos;ve
                  chosen them all — tap a selected time again to remove it.
                  You&apos;re charged per session.
                </p>

                {chosenSlots.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No appointments chosen yet.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-1.5">
                    {chosenSlots.map((s, i) => (
                      <li
                        key={slotKey(s.date, s.time)}
                        className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                      >
                        <span>
                          <span className="font-medium">
                            Session {i + 1}
                          </span>{" "}
                          — {formatDate(s.date)} at {s.time}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSlot(s.date, s.time)}
                          className="shrink-0 text-xs font-medium text-muted-foreground hover:text-red-600"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                  <p className="text-sm">
                    <span className="text-muted-foreground">
                      {sessionCount} × {service?.priceLabel} ={" "}
                    </span>
                    <span className="text-lg font-bold text-primary">
                      {sessionCount > 0 ? totalLabel : "—"}
                    </span>
                  </p>
                  <Button
                    onClick={() => setStep("details")}
                    disabled={sessionCount < minSessions}
                    className="h-11 rounded-xl px-6"
                  >
                    {sessionCount < minSessions
                      ? `Choose ${minSessions - sessionCount} more`
                      : "Continue"}
                  </Button>
                </div>
              </div>
            )}
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

            {/* Summary — lists every appointment (a block has 2-5) and the
                total actually being charged (per-session price × sessions). */}
            {service && chosenSlots.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Booking Summary
                </h3>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service</span>
                    <span className="font-medium">{service.title}</span>
                  </div>
                  {chosenSlots.map((s, i) => (
                    <div
                      key={slotKey(s.date, s.time)}
                      className="flex justify-between"
                    >
                      <span className="text-muted-foreground">
                        {isBlock ? `Session ${i + 1}` : "Date"}
                      </span>
                      <span className="font-medium">
                        {formatDate(s.date)} at {s.time}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium">
                      {service.duration}
                      {isBlock ? " each" : ""}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="font-semibold">
                      Total
                      {isBlock && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({sessionCount} × {service.priceLabel})
                        </span>
                      )}
                    </span>
                    <span className="text-lg font-bold text-primary">
                      {totalLabel}
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
                  `Confirm Booking \u2014 ${totalLabel}`
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

            {service && chosenSlots.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 text-left shadow-[var(--shadow-sm)]">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service</span>
                    <span className="font-medium">{service.title}</span>
                  </div>
                  {chosenSlots.map((s, i) => (
                    <div
                      key={slotKey(s.date, s.time)}
                      className="flex justify-between"
                    >
                      <span className="text-muted-foreground">
                        {chosenSlots.length > 1 ? `Session ${i + 1}` : "Date"}
                      </span>
                      <span className="font-medium">
                        {formatDate(s.date)} at {s.time}
                      </span>
                    </div>
                  ))}
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
                setChosenSlots([]);
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
/** Compact therapist card — photo, name, bio, phone — shown on a service
 * or clinic so parents see who they'll be seeing. Renders nothing if the
 * service has no assigned therapist profile. */
function TherapistMini({ service: s }: { service: ServiceCatalogueRow }) {
  if (!s.ownerName && !s.ownerPhotoUrl && !s.ownerBio && !s.ownerPhone)
    return null;
  return (
    <div className="mt-3 flex items-start gap-3 rounded-xl bg-muted/40 p-3">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
        {s.ownerPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.ownerPhotoUrl}
            alt={s.ownerName ?? "Therapist"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Users className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {s.ownerName && (
          <p className="text-sm font-semibold">{s.ownerName}</p>
        )}
        {s.ownerBio && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {s.ownerBio}
          </p>
        )}
        {s.ownerPhone && (
          <p className="mt-1 text-xs text-muted-foreground">{s.ownerPhone}</p>
        )}
      </div>
    </div>
  );
}

function ServicePicker({
  services,
  onSelect,
}: {
  services: ServiceCatalogueRow[];
  onSelect: (id: string) => void;
}) {
  // Full service descriptions always show — parents need to see exactly
  // what each service involves before booking (some, e.g. School
  // Observation, explain a lot), so nothing is clipped.

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
              return (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(s.id);
                    }
                  }}
                  className="group relative cursor-pointer rounded-2xl border-2 border-border bg-card p-5 text-left shadow-[var(--shadow-sm)] card-lift hover:border-primary"
                >
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
                          {s.ownerName &&
                            !s.ownerPhotoUrl &&
                            !s.ownerBio &&
                            !s.ownerPhone && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                with {s.ownerName}
                              </span>
                            )}
                        </div>
                      )}
                      {/* Full description — always shown so parents can
                          read everything a service involves before booking. */}
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {s.description}
                      </p>
                      {/* Therapist profile (photo + bio + phone) when set. */}
                      <TherapistMini service={s} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import {
  Suspense,
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
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
  Check,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowLeft,
  MapPin,
} from "lucide-react";
import { SubmarineHeader } from "@/components/storefront/submarine-header";
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

/**
 * Pence to a price a person would write. Dividing by 100 alone turned
 * 8940 into "£89.4", which reads like a typo on a price tag.
 */
function formatPrice(pence: number): string {
  if (pence === 0) return "Free";
  const pounds = pence / 100;
  return `£${Number.isInteger(pounds) ? pounds : pounds.toFixed(2)}`;
}

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
    priceLabel: formatPrice(row.pricePence),
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
        <div className="sub min-h-screen">
          <div className="mx-auto max-w-5xl p-10 text-center text-sm font-semibold text-[#6B7794]">
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
  // The calendar shows a month at a time. Anchored to the 1st so month
  // arithmetic can't trip over a 31st landing in a 30-day month.
  const [monthAnchor, setMonthAnchor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
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

  // Parent testimonials for the trust section under the booking card.
  const [testimonials, setTestimonials] = useState<
    { quote: string; author: string; meta?: string }[]
  >([]);
  useEffect(() => {
    fetch("/api/settings/storefront")
      .then((r) => r.json())
      .then((d: { testimonials?: { quote: string; author: string; meta?: string }[] }) => {
        if (Array.isArray(d.testimonials)) setTestimonials(d.testimonials);
      })
      .catch(() => undefined);
  }, []);

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

  const firstStepRender = useRef(true);
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    if (typeof window === "undefined") return;
    // Snap to the top of the flow so a new step starts at its heading, not
    // wherever the last tap happened. Instant rather than smooth, and run
    // again on the next couple of frames: the calendar's availability
    // arrives a beat later and re-lays-out the page, which would otherwise
    // swallow a single scroll. window + both scrolling elements covers the
    // browsers that scroll <body> rather than <html>.
    const toTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    toTop();
    const r1 = requestAnimationFrame(toTop);
    const t1 = window.setTimeout(toTop, 120);
    return () => {
      cancelAnimationFrame(r1);
      window.clearTimeout(t1);
    };
  }, [step]);

  // Every day in the visible month, padded with blanks so the 1st lands
  // under its real weekday.
  const monthDays = useMemo(() => {
    const year = monthAnchor.getFullYear();
    const month = monthAnchor.getMonth();
    const lead = new Date(year, month, 1).getDay(); // 0 = Sunday
    const length = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= length; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [monthAnchor]);

  const monthRange = useMemo(() => {
    const year = monthAnchor.getFullYear();
    const month = monthAnchor.getMonth();
    return {
      first: new Date(year, month, 1),
      last: new Date(year, month + 1, 0),
    };
  }, [monthAnchor]);

  // Nothing to show for a month that has already been and gone.
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const canGoBack = monthAnchor > thisMonth;

  // Fetch computed availability for the visible week, scoped to the
  // chosen service so parents only see that service's days/times (e.g.
  // online consults on Wed/Fri, clinics on Tue/Thu, a monthly Armagh
  // clinic on its specific dates).
  const fetchSlots = useCallback(async () => {
    const from = localDateKey(monthRange.first);
    const to = localDateKey(monthRange.last);
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
  }, [monthRange, selectedService]);

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
    <div className="sub relative min-h-screen overflow-hidden">
      <SubmarineHeader />
      {/* Same ground as the rest of the storefront: dots, and a couple of
          soft shapes behind the content. */}
      <div className="sub-dots pointer-events-none absolute inset-x-0 top-0 h-[900px]" aria-hidden />
      <div
        className="pointer-events-none absolute -left-[120px] top-[60px] h-[420px] w-[420px] rounded-full bg-[#FFE9A8]"
        aria-hidden
      />

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

      <main className="relative mx-auto max-w-[1080px] px-4 py-10 sm:px-6">
        {/* ---- Progress indicator (hidden on the confirmation screen) ---- */}
        {step !== "confirmed" && (
          <ol className="mb-11 flex flex-wrap items-center justify-center gap-0">
            {(
              [
                { key: "service", label: "Service" },
                { key: "datetime", label: "Date & time" },
                { key: "details", label: "Your details" },
              ] as const
            ).map((s, i, arr) => {
              // The location picker is part of choosing a service, so it
              // shares the "Service" pill.
              const progressStep = step === "location" ? "service" : step;
              const currentIdx = arr.findIndex((x) => x.key === progressStep);
              const done = i < currentIdx;
              const current = i === currentIdx;
              return (
                <li key={s.key} className="flex items-center">
                  <button
                    type="button"
                    disabled={!done}
                    onClick={() =>
                      setStep(s.key === "service" ? "service" : s.key)
                    }
                    className={`flex items-center gap-3 rounded-full py-2.5 pl-3 pr-5 ${
                      current
                        ? "sub-edge bg-[#FFC93C]"
                        : done
                          ? "cursor-pointer border-[3px] border-[#12235B] bg-white hover:bg-[#FFF3D2]"
                          : "cursor-default border-[3px] border-[#E1D5C0] bg-white"
                    }`}
                  >
                    <span
                      className={`sub-display grid h-[30px] w-[30px] place-items-center rounded-full text-base ${
                        current
                          ? "bg-[#12235B] text-[#FFC93C]"
                          : done
                            ? "bg-[#17B0A7] text-white"
                            : "bg-[#F1E7D6] text-[#9AA3B8]"
                      }`}
                    >
                      {done ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <span
                      className={`text-[15px] font-extrabold ${
                        done || current ? "" : "text-[#9AA3B8]"
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                  {i < arr.length - 1 && (
                    <span
                      className={`h-1 w-6 sm:w-[46px] ${
                        done ? "bg-[#12235B]" : "bg-[#E7D9C0]"
                      }`}
                      aria-hidden
                    />
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {/* ------ STEP: SERVICE ------ */}
        {step === "service" && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="sub-display text-[40px] tracking-[-1.4px] sm:text-[58px]">
                Book a session
              </h1>
              <p className="mt-2.5 text-[18px] font-semibold text-[#5A6785]">
                Pick what you need — we&apos;ll find you a time next.
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
                    className="sub-press relative w-full overflow-hidden rounded-[34px] border-[3px] border-[#0A1740] bg-[#12235B] p-7 text-left shadow-[8px_8px_0_#FFC93C] sm:p-8"
                  >
                    <span
                      className="pointer-events-none absolute -right-[50px] -top-[70px] h-[240px] w-[240px] rounded-full"
                      style={{ background: "rgba(255,201,60,.16)" }}
                      aria-hidden
                    />
                    <span className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
                      <span className="block">
                        <span className="inline-block rounded-full bg-[#FFC93C] px-4 py-1.5 text-xs font-extrabold uppercase tracking-[1.4px] text-[#12235B]">
                          Most requested
                        </span>
                        <span className="sub-display mb-1.5 mt-3.5 block text-[26px] text-white sm:text-[34px]">
                          Face to Face OT Assessment
                        </span>
                        <span className="block text-base font-bold text-[#FFC93C]">
                          {assessmentPriceLabel}
                          <span className="font-semibold text-[#8DA0D0]">
                            {assessmentPriceLabel ? " · " : ""}
                            {locationServices.length} clinic location
                            {locationServices.length === 1 ? "" : "s"}
                          </span>
                        </span>
                        <span className="mb-5 mt-3.5 block max-w-[560px] text-base font-semibold leading-relaxed text-[#C6D0EA]">
                          A full in-person occupational therapy assessment.
                          Choose the clinic nearest you to see available dates.
                        </span>
                        <span className="flex flex-wrap gap-2.5">
                          {locationServices.map((s) => (
                            <span
                              key={s.id}
                              className="rounded-full border-[3px] border-[#0A1740] bg-white px-4 py-2 text-sm font-extrabold"
                            >
                              {s.locationLabel}
                            </span>
                          ))}
                        </span>
                      </span>
                      <span className="sub-display justify-self-start whitespace-nowrap rounded-full border-[3px] border-[#0A1740] bg-[#E71D57] px-7 py-4 text-[19px] text-white shadow-[5px_5px_0_#0A1740] md:justify-self-end">
                        See available dates →
                      </span>
                    </span>
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
              className="inline-flex items-center gap-1.5 text-[15px] font-bold text-[#6B7794] hover:text-[#12235B]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to services
            </button>

            <div className="text-center">
              <h1 className="sub-display text-[34px] tracking-[-1px] sm:text-[44px]">
                Face to Face OT Assessment
              </h1>
              <p className="mt-2.5 text-[17px] font-semibold text-[#5A6785]">
                Choose your nearest clinic to see available dates.
              </p>
            </div>

            <div className="grid items-start gap-6 sm:grid-cols-2">
              {locationServices.map((s, i) => {
                const accent = ["#17B0A7", "#E71D57", "#FFC93C"][i % 3];
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => chooseService(s.id)}
                    className="sub-press flex flex-col rounded-[30px] border-[3px] border-[#12235B] bg-white p-7 text-left"
                    style={{ boxShadow: `6px 6px 0 ${accent}` }}
                  >
                    <span className="flex items-center gap-3.5">
                      <span
                        className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[18px] border-[3px] border-[#12235B]"
                        style={{ backgroundColor: accent }}
                      >
                        <MapPin className="h-6 w-6 text-white" />
                      </span>
                      <span className="min-w-0">
                        <span className="sub-display block text-[22px] leading-tight">
                          {s.locationLabel ?? s.title}
                        </span>
                        <span className="block text-[15px] font-bold text-[#E71D57]">
                          {s.priceLabel}
                          <span className="font-semibold text-[#6B7794]">
                            {" · "}
                            {s.duration}
                          </span>
                        </span>
                      </span>
                    </span>

                    {/* Who you'd be seeing at this clinic. */}
                    <TherapistMini service={s} />

                    <span className="mt-6 block rounded-full border-[3px] border-[#12235B] bg-[#FFC93C] px-6 py-3.5 text-center text-base font-extrabold">
                      See dates
                    </span>
                  </button>
                );
              })}
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
              <div className="flex flex-wrap items-center gap-4 rounded-[24px] border-[3px] border-[#12235B] bg-white p-4 shadow-[5px_5px_0_#17B0A7] sm:px-6">
                <span
                  className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[15px] border-[3px] border-[#12235B]"
                  style={{ backgroundColor: service.colour }}
                >
                  <service.icon className="h-5 w-5 text-white" />
                </span>
                <div className="min-w-0">
                  <p className="sub-display text-[20px] leading-tight sm:text-[22px]">
                    {service.title}
                  </p>
                  <p className="text-[15px] font-bold text-[#E71D57]">
                    {service.priceLabel}
                    <span className="font-semibold text-[#6B7794]">
                      {" · "}
                      {service.duration}
                    </span>
                  </p>
                </div>
                {/* A way back that doesn't need the browser's back button. */}
                <button
                  type="button"
                  onClick={() =>
                    setStep(isLocationAssessment(service) ? "location" : "service")
                  }
                  className="ml-auto whitespace-nowrap rounded-full border-[3px] border-[#12235B] bg-[#FFF3D2] px-5 py-2.5 text-sm font-extrabold hover:bg-[#FFC93C]"
                >
                  Change
                </button>
              </div>
            )}

            <div>
              <h2 className="sub-display text-[30px] tracking-[-.9px] sm:text-[38px]">
                Choose a date and time
              </h2>
              <p className="mt-2 text-[17px] font-semibold text-[#5A6785]">
                Days with a yellow shadow have space. All times are shown in
                your local timezone.
              </p>
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
              {/* ── The month ─────────────────────────────────────── */}
              <div className="sub-edge-xl rounded-[32px] bg-white p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setMonthAnchor(
                        (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1),
                      )
                    }
                    disabled={!canGoBack}
                    aria-label="Previous month"
                    className="grid h-11 w-11 place-items-center rounded-full border-[3px] border-[#12235B] bg-[#FFF3D2] text-lg font-extrabold hover:bg-[#FFC93C] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="sub-display text-[22px] sm:text-[26px]">
                    {monthAnchor.toLocaleDateString("en-GB", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setMonthAnchor(
                        (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1),
                      )
                    }
                    aria-label="Next month"
                    className="grid h-11 w-11 place-items-center rounded-full border-[3px] border-[#12235B] bg-[#FFF3D2] text-lg font-extrabold hover:bg-[#FFC93C]"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                <div className="mb-2 grid grid-cols-7 gap-2">
                  {DAY_NAMES.map((d) => (
                    /* Browsers translate weekday names, and a mistranslated
                       one on the booking page is worse than in admin. */
                    <span
                      key={d}
                      translate="no"
                      className="notranslate text-center text-[11px] font-extrabold uppercase tracking-[1px] text-[#9AA3B8] sm:text-xs"
                    >
                      {d}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2 sm:gap-2.5">
                  {monthDays.map((day, i) => {
                    if (!day) return <span key={`pad-${i}`} aria-hidden />;

                    const dayStart = new Date(
                      day.getFullYear(),
                      day.getMonth(),
                      day.getDate(),
                    );
                    const todayStart = new Date(
                      today.getFullYear(),
                      today.getMonth(),
                      today.getDate(),
                    );
                    const isPast = dayStart < todayStart;
                    const times = getAvailableTimes(day);
                    // Before the month's availability lands, days are shown
                    // as plain rather than guessed at.
                    const count = Array.isArray(times) ? times.length : 0;
                    const open = !isPast && count > 0;
                    const selected =
                      !!selectedDate && isSameDay(day, selectedDate);
                    const picked = chosenSlots.filter((sl) =>
                      isSameDay(sl.date, day),
                    ).length;

                    return (
                      <button
                        key={localDateKey(day)}
                        type="button"
                        disabled={!open}
                        onClick={() => {
                          setSelectedDate(day);
                          setSelectedTime(null);
                        }}
                        className={`flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-[18px] transition sm:min-h-[74px] ${
                          selected
                            ? "border-[3px] border-[#12235B] bg-[#12235B] text-white shadow-[3px_3px_0_#FFC93C]"
                            : open
                              ? "border-[3px] border-[#12235B] bg-white shadow-[3px_3px_0_#FFE9A8] hover:bg-[#FFF3D2]"
                              : "cursor-not-allowed border-[3px] border-transparent text-[#B6BAC8]"
                        }`}
                      >
                        <span className="sub-display text-[18px] sm:text-[21px]">
                          {day.getDate()}
                        </span>
                        <span
                          className={`text-[9.5px] font-extrabold uppercase tracking-[.6px] sm:text-[10.5px] ${
                            selected
                              ? "text-[#FFC93C]"
                              : open
                                ? "text-[#17B0A7]"
                                : "text-[#C6BFB0]"
                          }`}
                        >
                          {picked > 0
                            ? `${picked} picked`
                            : open
                              ? `${count} slot${count === 1 ? "" : "s"}`
                              : isPast || !slotsLoaded
                                ? ""
                                : "Full"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-wrap gap-4 border-t-2 border-[#F2E9DA] pt-4">
                  <span className="flex items-center gap-2 text-[13px] font-bold text-[#5A6785]">
                    <span className="h-[18px] w-[18px] rounded-md border-[3px] border-[#12235B] bg-white shadow-[2px_2px_0_#FFE9A8]" />
                    Space available
                  </span>
                  <span className="flex items-center gap-2 text-[13px] font-bold text-[#5A6785]">
                    <span className="h-[18px] w-[18px] rounded-md bg-[#12235B]" />
                    Selected
                  </span>
                  <span className="flex items-center gap-2 text-[13px] font-bold text-[#9AA3B8]">
                    <span className="h-[18px] w-[18px] rounded-md bg-[#F3EDE0]" />
                    Full or closed
                  </span>
                </div>
              </div>

              {/* ── The times for the chosen day ───────────────────── */}
              <div className="relative overflow-hidden rounded-[32px] border-[3px] border-[#0A1740] bg-[#12235B] p-6 shadow-[8px_8px_0_#E71D57] lg:sticky lg:top-24">
                <span
                  className="pointer-events-none absolute -right-[50px] -top-[60px] h-[200px] w-[200px] rounded-full"
                  style={{ background: "rgba(255,201,60,.16)" }}
                  aria-hidden
                />

                {!selectedDate ? (
                  <div className="relative py-8 text-center">
                    <span
                      className="mx-auto mb-5 block h-[66px] w-[66px] rounded-[22px] border-[3px] border-[#0A1740] bg-[#FFC93C]"
                      aria-hidden
                    />
                    <p className="sub-display text-[23px] text-white">
                      Pick a day to start
                    </p>
                    <p className="mt-2 text-[15px] font-semibold text-[#C6D0EA]">
                      Choose any highlighted date and the available times will
                      appear here.
                    </p>
                  </div>
                ) : (
                  (() => {
                    const times = getAvailableTimes(selectedDate) ?? [];
                    return (
                      <div className="relative">
                        <p className="text-xs font-extrabold uppercase tracking-[1.4px] text-[#FFC93C]">
                          Available times
                        </p>
                        <p className="sub-display mb-5 mt-2 text-[26px] text-white">
                          {DAY_FULL[selectedDate.getDay()]}{" "}
                          {selectedDate.getDate()}{" "}
                          {selectedDate.toLocaleDateString("en-GB", {
                            month: "long",
                          })}
                        </p>

                        {!slotsLoaded ? (
                          <p className="flex items-center gap-2 text-[15px] font-semibold text-[#C6D0EA]">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Checking what&apos;s free…
                          </p>
                        ) : times.length === 0 ? (
                          <p className="text-[15px] font-semibold text-[#C6D0EA]">
                            Nothing free on this day — try another.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-2.5">
                            {times.map((time) => {
                              const chosen = isSlotChosen(selectedDate, time);
                              const atCap =
                                isBlock &&
                                !chosen &&
                                sessionCount >= maxSessions;
                              return (
                                <button
                                  key={time}
                                  type="button"
                                  disabled={atCap}
                                  title={
                                    atCap
                                      ? `You've picked the maximum of ${maxSessions} sessions`
                                      : undefined
                                  }
                                  onClick={() => {
                                    toggleSlot(selectedDate, time);
                                    if (!isBlock) setSelectedTime(time);
                                  }}
                                  className={`rounded-full border-[3px] border-[#0A1740] py-3.5 text-center text-base font-extrabold transition ${
                                    chosen
                                      ? "bg-[#FFC93C] text-[#12235B]"
                                      : atCap
                                        ? "cursor-not-allowed bg-white/40 text-[#12235B]/40"
                                        : "bg-white text-[#12235B] hover:bg-[#FFF3D2]"
                                  }`}
                                >
                                  {time}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* One button, right under the times — the old
                            Continue sat far below the fold and people kept
                            hunting for it. */}
                        <button
                          type="button"
                          disabled={sessionCount < minSessions}
                          onClick={() => setStep("details")}
                          className="sub-display mt-5 w-full rounded-full border-[3px] border-[#0A1740] bg-[#E71D57] px-6 py-3.5 text-[18px] text-white shadow-[4px_4px_0_#0A1740] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#0A1740] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {sessionCount < minSessions
                            ? isBlock
                              ? `Choose ${minSessions - sessionCount} more`
                              : "Pick a time"
                            : "Continue →"}
                        </button>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>

            {/* Block bookings: running list of the dates picked so far +
                the live total, then Continue once they've hit the minimum.
                (A single appointment jumps straight to the details form,
                so this never shows for one.) */}
            {isBlock && (
              <div className="sub-edge rounded-[26px] bg-white p-6">
                <p className="sub-display text-xl">
                  Choose {minSessions}
                  {maxSessions > minSessions ? `–${maxSessions}` : ""}{" "}
                  appointments
                </p>
                <p className="mt-1.5 text-[15px] font-semibold text-[#6B7794]">
                  Pick a day, then tap a time. Repeat until you&apos;ve chosen
                  them all — tap a selected time again to remove it.
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
                        className="flex items-center justify-between gap-3 rounded-[14px] border-2 border-[#F2E9DA] bg-[#FFFCF6] px-4 py-2.5 text-[15px] font-semibold"
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

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#F2E9DA] pt-4">
                  <p className="text-[15px] font-semibold text-[#6B7794]">
                    {sessionCount} × {service?.priceLabel} ={" "}
                    <span className="sub-display text-xl text-[#12235B]">
                      {sessionCount > 0 ? totalLabel : "—"}
                    </span>
                  </p>
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
              <div className="sub-edge rounded-[26px] bg-white p-6">
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

            <h2 className="sub-display text-2xl">Your details</h2>

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
              <div className="sub-edge rounded-[26px] bg-white p-6 text-left">
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

      {/* Parent testimonials — social proof before/after booking. */}
      {testimonials.length > 0 && (
        <section className="relative border-t-2 border-[#F2E4CD] py-14">
          <div className="mx-auto max-w-[1080px] px-4">
            <h2 className="sub-display text-center text-[30px] tracking-[-.8px] sm:text-[40px]">
              What families say
            </h2>
            <div className="mt-8 grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t, i) => (
                <figure
                  key={i}
                  className="sub-edge flex flex-col rounded-[26px] bg-white p-6"
                >
                  <div className="mb-2 text-amber-400" aria-hidden>
                    ★★★★★
                  </div>
                  <blockquote className="flex-1 text-sm leading-relaxed text-foreground/90">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-3 text-xs">
                    <span className="font-semibold">{t.author}</span>
                    {t.meta && (
                      <span className="text-muted-foreground"> · {t.meta}</span>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

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
    <div className="space-y-11">
      {groups.map(([category, items]) => (
        <div key={category}>
          {/* A section rule in the storefront's voice, rather than a
              whispered uppercase label. */}
          <div className="mb-5 flex items-center gap-3.5">
            <span className="sub-display text-2xl">
              {groups.length > 1 ? category : "Parents & individuals"}
            </span>
            <span className="h-[3px] flex-1 bg-[#EADCC4]" aria-hidden />
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            {items.map((s, i) => {
              const Icon = s.icon;
              // The three accents take turns, so a column of cards doesn't
              // come out all one colour.
              const accent = ["#17B0A7", "#E71D57", "#FFC93C"][i % 3];
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
                  className="sub-press flex cursor-pointer flex-col rounded-[30px] border-[3px] border-[#12235B] bg-white p-7"
                  style={{ boxShadow: `6px 6px 0 ${accent}` }}
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[18px] border-[3px] border-[#12235B]"
                      style={{ backgroundColor: accent }}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="sub-display text-[22px] leading-tight">
                        {s.title}
                      </h3>
                      <p className="text-[15px] font-bold text-[#E71D57]">
                        {s.priceLabel}
                        <span className="font-semibold text-[#6B7794]">
                          {" · "}
                          {s.duration}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Mode / location / associate badges, so an online
                      consult is distinguishable from an Armagh clinic at a
                      glance, and you can see who you'd be seeing. */}
                  {(s.mode === "online" || s.locationLabel) && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {s.mode === "online" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#C2E7E3] bg-[#E7F6F4] px-3 py-1 text-[13px] font-bold">
                          <Globe className="h-3.5 w-3.5" />
                          Online
                        </span>
                      )}
                      {s.mode === "home" && (
                        <span className="rounded-full border-2 border-[#F3DFA6] bg-[#FFF3D2] px-3 py-1 text-[13px] font-bold">
                          Home visit
                        </span>
                      )}
                      {s.locationLabel && s.mode !== "online" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#F3DFA6] bg-[#FFF3D2] px-3 py-1 text-[13px] font-bold">
                          <MapPin className="h-3.5 w-3.5" />
                          {s.locationLabel}
                        </span>
                      )}
                    </div>
                  )}

                  {/* The whole description, never clipped — some services
                      take a paragraph to explain, and that paragraph is
                      what a parent is deciding on. */}
                  <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-[#3D4A6B]">
                    {s.description}
                  </p>

                  {/* Grace's steer: name a therapist only on the Face to
                      Face assessment. Every other service is delivered by
                      whichever specialist OT the chosen date and location
                      resolve to, so we say that rather than a name. */}
                  <div className="mt-4 flex items-start gap-3 rounded-[18px] border-2 border-[#C2E7E3] bg-[#F0FAF9] p-3.5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#17B0A7] text-white">
                      <Users className="h-4 w-4" />
                    </span>
                    <p className="text-sm font-semibold leading-relaxed text-[#3D4A6B]">
                      Delivered by one of our specialist occupational
                      therapists — allocated based on the{" "}
                      {s.mode === "online" ? "date" : "date and location"} you
                      choose.
                    </p>
                  </div>

                  <span className="sub-press mt-6 block rounded-full border-[3px] border-[#12235B] bg-[#FFC93C] px-6 py-3.5 text-center text-base font-extrabold text-[#12235B]">
                    Choose this
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

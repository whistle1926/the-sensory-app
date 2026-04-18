"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { StorefrontHeader } from "@/components/courses/storefront-header";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const services = [
  {
    id: "initial-ot",
    title: "Initial OT Consultation",
    duration: "60 minutes",
    durationMins: 60,
    price: 8500,
    priceLabel: "\u00a385",
    description:
      "Comprehensive initial assessment via video call. Includes discussion of presenting concerns, observation of your child during play, and immediate practical recommendations.",
    icon: Video,
    colour: "oklch(0.55 0.20 264)",
  },
  {
    id: "follow-up",
    title: "Follow-Up Session",
    duration: "45 minutes",
    durationMins: 45,
    price: 6500,
    priceLabel: "\u00a365",
    description:
      "Review progress, adjust strategies, and address new concerns. Includes updated home programme recommendations.",
    icon: Clock,
    colour: "oklch(0.60 0.18 170)",
  },
  {
    id: "school",
    title: "School Consultation",
    duration: "30 minutes",
    durationMins: 30,
    price: 4500,
    priceLabel: "\u00a345",
    description:
      "Video call with your child\u2019s teacher or SENCO to discuss sensory strategies for the classroom.",
    icon: Users,
    colour: "oklch(0.65 0.17 50)",
  },
  {
    id: "sensory-eaters",
    title: "Sensory Eaters Programme",
    duration: "6 \u00d7 45-minute sessions",
    durationMins: 270,
    price: 25000,
    priceLabel: "\u00a3250",
    description:
      "Structured online programme for parents of children with selective eating. Small group format (max 6 families).",
    icon: Globe,
    colour: "oklch(0.55 0.20 310)",
  },
];

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

export default function BookingPage() {
  const today = useMemo(() => new Date(), []);
  const { data: session } = useSession();
  const isClient = session?.user?.role === "CLIENT";

  const [step, setStep] = useState<Step>("service");
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [accountCreated, setAccountCreated] = useState(false);

  // Computed available slots per date { "2026-04-07": ["09:00","09:30",...], ... }
  const [computedSlots, setComputedSlots] = useState<Record<string, string[]>>({});
  const [slotsLoaded, setSlotsLoaded] = useState(false);

  const service = services.find((s) => s.id === selectedService);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Fetch computed availability for the visible week
  const fetchSlots = useCallback(async () => {
    const from = weekDays[0].toISOString().split("T")[0];
    const to = weekDays[6].toISOString().split("T")[0];
    try {
      const res = await fetch(`/api/availability?from=${from}&to=${to}`);
      if (res.ok) {
        const data = await res.json();
        setComputedSlots((prev) => ({ ...prev, ...data }));
        setSlotsLoaded(true);
      }
    } catch {
      // silent
    }
  }, [weekDays]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Get available times for a selected date
  function getAvailableTimes(date: Date) {
    const dateKey = date.toISOString().split("T")[0];
    const slots = computedSlots[dateKey];

    // Not yet loaded — return null to show all (backward compat)
    if (!slotsLoaded) return null;

    return slots || [];
  }

  /* ------ Submit booking ------ */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!service || !selectedDate || !selectedTime) return;

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

            <div className="grid gap-4 sm:grid-cols-2">
              {services.map((s) => {
                const Icon = s.icon;
                const isSelected = selectedService === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedService(s.id)}
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
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {s.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

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

              {submitError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {submitError}
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || !name || !email}
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

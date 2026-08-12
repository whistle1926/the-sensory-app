import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  UserCog,
} from "lucide-react";

/**
 * Screen recordings of each step, taken in the live portal. Nobody reads a
 * wall of instructions — a five-second clip of the actual clicks lands far
 * better. Re-record and swap the URLs if the screens change.
 */
const BLOB = "https://s8drav6ybdgfs9gv.public.blob.vercel-storage.com/help-clips/";
const CLIPS = {
  runBy: BLOB + "step1-run-by-8UUook7DIPSIBMJqo8xqwfzTIfSkft.mp4",
  hours: BLOB + "step2-hours-7OHEBk2cRLnhmh6yrCmwRRi9Xx9lay.mp4",
  override: BLOB + "step3-override-bflw7EQmQYWYQAJ6lLlUHrHoprFbCn.mp4",
  newBooking: BLOB + "step4-new-booking-w2PtKGeNZLD76sLelypR97tyhYDfMn.mp4",
};

export interface BookingsSetupState {
  totalServices: number;
  servicesWithoutOwner: string[];
  servicesWithOwnHours: number;
  dateOverrides: number;
  calendarsConnected: number;
  staffCount: number;
  googleSyncOn: boolean;
}

/**
 * "How bookings and calendars work" — written for Claire.
 *
 * The important thing this page does is show the SETUP STATE alongside the
 * explanation. Nearly everything she asked for already works; it looks broken
 * because services have no owner and share one schedule. Explaining the
 * mechanism without showing that would leave her none the wiser.
 */
export function BookingsHelpContent({ state }: { state: BookingsSetupState }) {
  const unowned = state.servicesWithoutOwner.length;
  const needsSetup =
    unowned > 0 || state.servicesWithOwnHours === 0 || !state.googleSyncOn;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <header>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
            <CalendarDays className="h-6 w-6 text-primary" />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              How bookings and calendars work
            </h1>
            <p className="text-sm text-muted-foreground">
              What decides when a client can book, and whose diary it lands in.
            </p>
          </div>
        </div>
      </header>

      {/* ── The mental model ───────────────────────────────────────── */}
      <section className="rounded-2xl border-2 border-primary/30 bg-primary/[0.03] p-6">
        <h2 className="text-base font-bold">
          The one idea everything hangs off: the <em>service</em>
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          A service is a thing someone can book — &ldquo;OT Assessment —
          Coalisland&rdquo;, &ldquo;School Observation&rdquo;, &ldquo;Sensory
          Play Session&rdquo;. Almost every question about the calendar comes
          back to it, because <strong>each service carries its own owner and
          its own opening hours</strong>.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            { icon: MapPin, title: "Service", body: "What's being booked, and its price and length." },
            { icon: UserCog, title: "Owner", body: "Which OT it belongs to. Their diary, their emails." },
            { icon: Clock, title: "Hours", body: "When that service can be booked. Set per service." },
            { icon: CalendarDays, title: "Calendar", body: "Where the booking lands once it's made." },
          ].map((s) => (
            <div key={s.title} className="rounded-xl border border-border bg-card p-3">
              <s.icon className="h-4 w-4 text-primary" />
              <p className="mt-1.5 text-sm font-bold">{s.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-4 rounded-lg border-l-4 border-primary/40 bg-muted/40 p-3 text-sm leading-relaxed">
          So &ldquo;Grace is free Tuesday 9–2 for assessments, Wednesdays for
          school visits&rdquo; isn&apos;t one setting — it&apos;s{" "}
          <strong>the assessment service open Tuesdays</strong> and{" "}
          <strong>the school visit service open Wednesdays</strong>, both owned
          by Grace. That&apos;s the bit that surprises people.
        </p>
      </section>

      {/* ── Live setup state ───────────────────────────────────────── */}
      {needsSetup && (
        <section className="rounded-2xl border-2 border-amber-500/40 bg-amber-50 p-6 dark:bg-amber-950/20">
          <h2 className="flex items-center gap-2 text-base font-bold text-amber-900 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            Why it isn&apos;t behaving that way yet
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-900/80 dark:text-amber-200/80">
            All of the above already works. It doesn&apos;t look like it
            because the services haven&apos;t been set up yet:
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {unowned > 0 && (
              <li className="flex gap-2 text-amber-900/90 dark:text-amber-200/90">
                <span>•</span>
                <span>
                  <strong>{unowned} of {state.totalServices} services have no
                  owner.</strong>{" "}
                  Nobody&apos;s diary is attached, so bookings
                  can&apos;t be told apart by OT and the &ldquo;new
                  booking&rdquo; email goes to the practice inbox instead of a
                  person. Unassigned: {state.servicesWithoutOwner.join(", ")}.
                </span>
              </li>
            )}
            {state.servicesWithOwnHours === 0 && (
              <li className="flex gap-2 text-amber-900/90 dark:text-amber-200/90">
                <span>•</span>
                <span>
                  <strong>No service has its own hours.</strong>{" "}They all share
                  one schedule, so every service looks available at the same
                  times.
                </span>
              </li>
            )}
            {!state.googleSyncOn && (
              <li className="flex gap-2 text-amber-900/90 dark:text-amber-200/90">
                <span>•</span>
                <span>
                  <strong>Two-way Google sync isn&apos;t switched on.</strong>{" "}
                  Bookings don&apos;t write themselves into Google yet — that
                  needs credentials adding, which is Paddy&apos;s job.
                </span>
              </li>
            )}
            {state.calendarsConnected < state.staffCount && (
              <li className="flex gap-2 text-amber-900/90 dark:text-amber-200/90">
                <span>•</span>
                <span>
                  <strong>
                    {state.calendarsConnected} of {state.staffCount} people have
                    connected a calendar.
                  </strong>{" "}
                  The master calendar only shows those who have.
                </span>
              </li>
            )}
          </ul>
          <p className="mt-3 text-sm text-amber-900/80 dark:text-amber-200/80">
            None of that needs a developer. It&apos;s all in Bookings →
            Services and Bookings → Availability.
          </p>
        </section>
      )}

      {/* ── Steps ─────────────────────────────────────────────────── */}
      <Card n={1} icon={UserCog} title="Say who runs each service">
        <p className="text-sm leading-relaxed text-muted-foreground">
          On the <strong>Services</strong> tab, press <strong>Edit</strong>{" "}on a
          service and set the <strong>Run by</strong>{" "}dropdown. That person is
          who the booking belongs to: it&apos;s their diary it blocks, and they
          get the &ldquo;New booking&rdquo; email. Left on &ldquo;The practice
          (default calendar)&rdquo; it still works — the email just goes to the
          practice inbox instead.
        </p>
        <Clip src={CLIPS.runBy} label="Services → Edit → Run by" />
        <Tip>
          Two OTs can hold the same slot as long as they&apos;re on different
          services. One OT can never be double-booked.
        </Tip>
        <Go href="/bookings" label="Open Bookings → Services" />
      </Card>

      <Card n={2} icon={Clock} title="Set the hours for each service">
        <p className="text-sm leading-relaxed text-muted-foreground">
          On the <strong>Availability</strong>{" "}tab, pick the service from
          &ldquo;Which service&apos;s availability?&rdquo;, then switch on the
          days and set the times underneath. This is how you get &ldquo;9 to 2
          on a Tuesday for assessments, Wednesdays for school visits&rdquo; —
          you set it on each service separately, not on the person.
        </p>
        <Clip src={CLIPS.hours} label="Availability → pick a service → weekly hours" />
        <Tip>
          Each block of hours is one bookable appointment, so 9:15–10:00 offers
          a 9:15 slot. Until a service has hours of its own it falls back to the
          shared default schedule — which is why everything currently looks open
          at the same times.
        </Tip>
      </Card>

      <Card n={3} icon={CalendarDays} title="Change one particular day">
        <p className="text-sm leading-relaxed text-muted-foreground">
          For &ldquo;Tuesday 11th only 10–12&rdquo; or &ldquo;away that
          Thursday&rdquo;, scroll to <strong>Date-specific overrides</strong>{" "}at
          the bottom of Availability. Pick the date, choose Unavailable or
          Custom hours, and press Add Override. It beats the weekly pattern for
          that day only.
        </p>
        <Clip src={CLIPS.override} label="Availability → Date-specific overrides" />
        <Tip>
          This is also how you block time out — an override marked unavailable
          stops anyone booking, without creating a fake appointment.
        </Tip>
        <p className="text-xs text-muted-foreground">
          {state.dateOverrides === 0
            ? "None set at the moment, so every week currently looks the same."
            : `${state.dateOverrides} in use at the moment.`}
        </p>
      </Card>

      <Card n={4} icon={Mail} title="What happens when someone books">
        <ol className="space-y-2.5">
          <Bullet>The appointment appears immediately under Bookings → Calendar.</Bullet>
          <Bullet>The client gets a confirmation email.</Bullet>
          <Bullet>
            The owning OT gets a &ldquo;New booking&rdquo; email — or the
            practice inbox if the service has no owner.
          </Bullet>
          <Bullet>
            For services set to do so, the <strong>referral form is emailed to
            the client automatically</strong>{" "}
            once the booking is paid. That&apos;s
            a switch per service in the Services editor.
          </Bullet>
          <Bullet>
            The day before, the client gets a reminder — and if they booked too
            late for the morning batch, it goes out straight away instead.
          </Bullet>
        </ol>
      </Card>

      <Card n={5} icon={CalendarDays} title="Adding something yourself">
        <p className="text-sm leading-relaxed text-muted-foreground">
          <strong>New booking</strong>, top right, creates an appointment on
          someone&apos;s behalf — for a phone enquiry, say. Pick the service and
          the price fills in for itself; start typing a name to find an existing
          client. It skips the terms tick-boxes, since the parent isn&apos;t
          sitting at the form, and otherwise behaves exactly like a client
          booking.
        </p>
        <Clip src={CLIPS.newBooking} label="New booking" />
        <Tip>
          To hold time without inventing a client, use a date override marked
          unavailable instead.
        </Tip>
      </Card>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-base font-bold">Where Google fits in</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Two separate connections, pointing opposite ways, set up per person.
          It catches everyone out, so it has its own page.
        </p>
        <Go href="/help/calendars" label="How the calendars link to Google" />
      </section>
    </div>
  );
}

function Card({
  n,
  icon: Icon,
  title,
  children,
}: {
  n: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {n}
        </span>
        <h2 className="flex items-center gap-2 pt-1 text-base font-bold">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </h2>
      </div>
      <div className="mt-3 space-y-3 sm:pl-12">{children}</div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm leading-relaxed">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}

/**
 * A silent, looping screen recording of the step. Autoplays and repeats so
 * there is nothing to press — if you miss it, it comes round again.
 */
function Clip({ src, label }: { src: string; label: string }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-muted/30">
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-label={label}
        className="block w-full"
      />
      <figcaption className="border-t border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground">
        {label}
      </figcaption>
    </figure>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

function Go({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

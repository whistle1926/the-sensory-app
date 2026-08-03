import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Mail,
  MousePointerClick,
  Settings as SettingsIcon,
  Users,
} from "lucide-react";

/**
 * Body of the "How the calendars work" explainer. Split out from the page so
 * the page owns auth/redirects and this owns presentation (and so it can be
 * rendered in isolation when capturing walkthrough screenshots).
 *
 * `autoSyncOn` is passed in rather than read here, so the copy always matches
 * the site's real configuration instead of claiming a feature that is off.
 */
export function CalendarHelpContent({ autoSyncOn }: { autoSyncOn: boolean }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
            <CalendarDays className="h-6 w-6 text-primary" />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              How the calendars work
            </h1>
            <p className="text-sm text-muted-foreground">
              What links to what, what&apos;s automatic, and what still needs a
              click.
            </p>
          </div>
        </div>
      </header>

      {/* ── The one big idea ───────────────────────────────────────── */}
      <section className="rounded-2xl border-2 border-primary/30 bg-primary/[0.03] p-6">
        <h2 className="text-base font-bold">
          The main thing to understand: there are two separate connections
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          They point in opposite directions and they are set up separately.
          Turning on one does <strong className="text-foreground">not</strong>{" "}
          turn on the other. This is the bit that catches everyone out.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
              Direction 1
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-bold">
              Portal booking <ArrowRight className="h-4 w-4 shrink-0" /> your
              Google diary
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Getting appointments people book with you{" "}
              <em>out of</em> the portal and <em>into</em> your Google Calendar.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
              Direction 2
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-bold">
              Your Google diary <ArrowRight className="h-4 w-4 shrink-0" />{" "}
              portal calendar
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Seeing your existing Google appointments{" "}
              <em>inside</em> the portal, so the diary isn&apos;t half-empty.
            </p>
          </div>
        </div>
      </section>

      {/* ── Step 1: what happens when a client books ──────────────── */}
      <Card
        n={1}
        icon={MousePointerClick}
        title="What happens the moment a client books"
      >
        <ol className="space-y-3">
          <Bullet>
            The client books on your public booking page and the appointment is
            created straight away.
          </Bullet>
          <Bullet>
            It appears <strong>immediately</strong> in the portal under{" "}
            <strong>Bookings → Calendar</strong>. Nothing to wait for.
          </Bullet>
          <Bullet>The client gets a confirmation email.</Bullet>
          <Bullet>
            The therapist who owns that service gets a{" "}
            <strong>&ldquo;New booking&rdquo;</strong> email. If the service has
            nobody assigned, it goes to the practice inbox instead.
          </Bullet>
          <Bullet>
            The day before, the client automatically gets a reminder email.
          </Bullet>
        </ol>
        <Note>
          So the portal always knows about every booking. Your{" "}
          <em>Google</em> calendar is the part that needs the extra step below.
        </Note>
      </Card>

      {/* ── Step 2: portal → Google ───────────────────────────────── */}
      <Card
        n={2}
        icon={Mail}
        title="Getting your bookings into your Google diary"
      >
        {autoSyncOn ? (
          <div className="rounded-xl border border-green-500/30 bg-green-50 p-4 dark:bg-green-950/20">
            <p className="flex items-center gap-2 text-sm font-bold text-green-800 dark:text-green-300">
              <Check className="h-4 w-4" />
              Automatic sync is switched on for this site
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-green-900/80 dark:text-green-200/80">
              Connect your Google account once in{" "}
              <strong>Settings → Calendar</strong> and every new booking for you
              is written straight into your Google Calendar — and removed again
              if it&apos;s cancelled. You&apos;ll still get the email, but you
              won&apos;t need to click anything.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/40 bg-amber-50 p-4 dark:bg-amber-950/20">
            <p className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              Right now this is a manual click — automatic sync is not switched
              on yet
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-amber-900/80 dark:text-amber-200/80">
              Bookings made in the portal do <strong>not</strong> appear in
              Google on their own. This is almost certainly the thing that has
              been confusing people.
            </p>
          </div>
        )}

        <p className="mt-4 text-sm font-semibold">
          How it works today, step by step:
        </p>
        <ol className="mt-2 space-y-3">
          <Bullet>
            Open the <strong>&ldquo;New booking&rdquo;</strong> email you were
            sent.
          </Bullet>
          <Bullet>
            Tap the <strong>&ldquo;📅 Add to Google Calendar&rdquo;</strong>{" "}
            button in that email.
          </Bullet>
          <Bullet>
            Google opens with the appointment already filled in — check it and
            press <strong>Save</strong>.
          </Bullet>
        </ol>
        <Note>
          If you never click that button, the appointment stays in the portal
          only. It is still a real booking — it just won&apos;t be in your phone
          or Google diary, so you won&apos;t get a Google alert for it.
        </Note>

        {!autoSyncOn && (
          <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            The fully automatic version is already built and ready — it just
            needs Google credentials adding to the site before it can be turned
            on. Ask Paddy if you&apos;d like that switched on, and this page
            will update itself once it is.
          </p>
        )}
      </Card>

      {/* ── Step 3: Google → portal ───────────────────────────────── */}
      <Card
        n={3}
        icon={SettingsIcon}
        title="Seeing your Google appointments inside the portal"
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          This is the other direction, and it&apos;s set up once per person. It
          stops the portal diary looking empty when most of your week actually
          lives in Google.
        </p>
        <ol className="mt-3 space-y-3">
          <Bullet>
            Go to <strong>Settings → Calendar</strong>.
          </Bullet>
          <Bullet>
            Paste in your Google{" "}
            <strong>&ldquo;Secret address in iCal format&rdquo;</strong>. The
            page walks you through exactly where to find it in Google.
          </Bullet>
          <Bullet>
            Pick a colour — that&apos;s how your events are identified on the
            shared team calendar.
          </Bullet>
        </ol>

        <div className="mt-4">
          <Link
            href="/help/calendars/setup"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90"
          >
            Show me how, click by click
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          <Warn icon={Clock} title="It is not live — expect a delay">
            Google only republishes that feed <strong>every few hours</strong>.
            A brand-new Google appointment will not show in the portal straight
            away, and that is normal, not a fault. If something is missing, it
            is nearly always just this delay.
          </Warn>
          <Warn icon={AlertTriangle} title="Those events are read-only here">
            Google events show tagged <strong>&ldquo;Google&rdquo;</strong> and
            can&apos;t be edited or deleted in the portal — change them in
            Google itself. Only portal bookings can be changed here.
          </Warn>
          <Warn icon={Users} title="It's per person, and it's shared">
            Everyone connects their own calendar. Once connected, your events
            are visible to the team on the shared calendar in your colour — so
            don&apos;t connect a personal calendar you&apos;d rather keep
            private.
          </Warn>
        </div>
      </Card>

      {/* ── Quick answers ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-base font-bold">
          &ldquo;Why isn&apos;t my appointment showing?&rdquo;
        </h2>
        <dl className="mt-4 space-y-4">
          <QA q="A booking was made but it's not in my Google calendar.">
            Expected{!autoSyncOn && " for now"} — you need to click{" "}
            <strong>Add to Google Calendar</strong> in the &ldquo;New
            booking&rdquo; email. The booking is safe in the portal either way.
          </QA>
          <QA q="I added something in Google but the portal doesn't show it.">
            Give it a few hours. Google only refreshes the feed periodically. If
            it still hasn&apos;t appeared the next day, re-paste your iCal link
            in Settings → Calendar.
          </QA>
          <QA q="The portal calendar is completely empty for me.">
            You probably haven&apos;t pasted your secret iCal link yet — see
            step 3 above. Portal bookings still show without it; it&apos;s your
            Google events that would be missing.
          </QA>
          <QA q="I can't edit a Google event in the portal.">
            That&apos;s intentional. Anything tagged &ldquo;Google&rdquo; is a
            read-only copy — edit it in Google and the change comes through on
            the next refresh.
          </QA>
          <QA q="A client booked but nobody got the email.">
            Check the service has a therapist assigned (Bookings → Services). If
            it has nobody assigned, the email goes to the practice inbox rather
            than to a person.
          </QA>
        </dl>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/settings?tab=calendar"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90"
        >
          <SettingsIcon className="h-4 w-4" />
          Open Calendar settings
        </Link>
        <Link
          href="/bookings"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-bold transition hover:bg-muted"
        >
          <CalendarDays className="h-4 w-4" />
          Go to Bookings
        </Link>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

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
      <div className="mt-4 pl-0 sm:pl-12">{children}</div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm leading-relaxed">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 rounded-lg border-l-4 border-primary/40 bg-muted/40 p-3 text-sm leading-relaxed">
      {children}
    </p>
  );
}

function Warn({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        {title}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  );
}

function QA({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-semibold">{q}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {children}
      </dd>
    </div>
  );
}

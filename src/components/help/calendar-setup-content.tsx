import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Laptop,
  Copy,
  MousePointer2,
} from "lucide-react";

/**
 * "Connect your calendar — step by step."
 *
 * Deliberately one instruction per step, in the order you actually do them,
 * with what you should SEE after each one. The previous version of these
 * instructions lived collapsed inside a <details> on the Settings page, which
 * is why nobody found them.
 *
 * Note on screenshots: the Google half of this happens inside the reader's own
 * Google account, so there are no screenshots of those screens here — the
 * wording describes exactly what to look for instead. The steps that happen
 * inside this app do show the real screen.
 */
export function CalendarSetupContent({
  settingsScreenshotUrl,
}: {
  /** Real screenshot of Settings → Calendar. Optional so the page still
   * renders if the image hasn't been captured yet. */
  settingsScreenshotUrl?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div>
        <Link
          href="/help/calendars"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to how the calendars work
        </Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight">
          Connect your calendar — step by step
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This makes your own Google appointments show up in the portal. There
          are two ways — try the one-click one first.
        </p>
      </div>

      {/* The easy route first — most people should never read the rest. */}
      <section className="rounded-2xl border-2 border-green-500/40 bg-green-50 p-5 dark:bg-green-950/20">
        <p className="text-base font-bold text-green-900 dark:text-green-300">
          Try this first — it takes one click
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-green-900/80 dark:text-green-200/80">
          Go to <strong>Settings → Calendar</strong> and press{" "}
          <strong>Connect Google Calendar</strong>. Sign in, tap Allow, and
          you&apos;re done — no hunting for hidden settings, no secret link, and
          it works on your phone. It also sets up the other direction at the
          same time, so your bookings go into Google automatically.
        </p>
        <Link
          href="/settings?tab=calendar"
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 dark:bg-green-600"
        >
          Take me there
        </Link>
        <p className="mt-3 text-xs text-green-900/70 dark:text-green-200/70">
          Only carry on below if that button isn&apos;t there yet, or you&apos;d
          rather not connect your Google account.
        </p>
      </section>

      {/* Before you start */}
      <section className="rounded-2xl border-2 border-amber-500/40 bg-amber-50 p-5 dark:bg-amber-950/20">
        <p className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-300">
          <Laptop className="h-4 w-4" />
          Read this first: use a computer, not your phone
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-amber-900/80 dark:text-amber-200/80">
          The setting you need is <strong>not in the Google Calendar phone
          app</strong>. It simply isn&apos;t there. This is what stops most
          people, and it isn&apos;t you doing anything wrong. Sit down at a
          laptop or desktop and it&apos;s straightforward.
        </p>
      </section>

      {/* PART 1 */}
      <PartHeading n="Part 1" title="Get your secret link out of Google" />

      <Step n={1} title="Open Google Calendar on your computer">
        Go to <Kbd>calendar.google.com</Kbd> and sign in if it asks you to.
        <Expect>You should see your usual calendar with your appointments.</Expect>
      </Step>

      <Step n={2} title="Find your calendar in the left-hand list">
        Look down the left side of the screen for the heading{" "}
        <Q>My calendars</Q>. Your name will be in the list underneath it.
        <Expect>
          You&apos;ve found the right list when you can see your own name, and
          usually things like &ldquo;Birthdays&rdquo; and &ldquo;Tasks&rdquo;
          under it.
        </Expect>
      </Step>

      <Step n={3} title="Hover your mouse over your name">
        Don&apos;t click yet — just rest the mouse pointer on your name. Three
        little dots <Kbd>⋮</Kbd> will appear to the right of it.
        <Expect>
          The three dots only show up while the mouse is sitting on the name. If
          you don&apos;t see them, move the pointer slightly.
        </Expect>
      </Step>

      <Step n={4} title="Click the three dots, then Settings and sharing">
        Click the <Kbd>⋮</Kbd> dots. A small menu opens. Click{" "}
        <Q>Settings and sharing</Q>.
        <Expect>A settings page opens with a long list of options.</Expect>
      </Step>

      <Step n={5} title="Scroll right down to Integrate calendar">
        Scroll to the very bottom of that settings page. You&apos;re looking for
        a section headed <Q>Integrate calendar</Q>.
        <Expect>
          It&apos;s near the bottom — keep going past the reminders and sharing
          sections.
        </Expect>
      </Step>

      <Step n={6} title="Copy the Secret address in iCal format" icon={Copy}>
        In that section, find the box labelled{" "}
        <Q>Secret address in iCal format</Q> and click the copy button beside
        it. Google may ask you to confirm — say yes.
        <Expect>
          The link you&apos;ve copied is very long and ends in{" "}
          <Kbd>.ics</Kbd>. That&apos;s how you know you have the right one.
        </Expect>
        <Danger>
          Keep this link private. Anyone who has it can see your appointments.
          Don&apos;t email it or put it in a message — you&apos;re about to
          paste it straight into the portal and that&apos;s the end of it.
        </Danger>
      </Step>

      {/* PART 2 */}
      <PartHeading n="Part 2" title="Paste it into the portal" />

      <Step n={7} title="Open Settings → Calendar in the portal">
        Come back to this app, click <Q>Settings</Q> in the menu, then the{" "}
        <Q>Calendar</Q> tab.
        <div className="mt-3">
          <Link
            href="/settings?tab=calendar"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
          >
            Open Calendar settings for me
          </Link>
        </div>
      </Step>

      <Step n={8} title="Paste the link into the box">
        Click into the box marked <Q>Secret iCal URL</Q> and paste (right-click
        → Paste, or <Kbd>Ctrl</Kbd>+<Kbd>V</Kbd>, or <Kbd>⌘</Kbd>+<Kbd>V</Kbd> on
        a Mac).
        {settingsScreenshotUrl && (
          <figure className="mt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={settingsScreenshotUrl}
              alt="The Calendar tab in Settings, showing the Secret iCal URL box and the colour picker"
              className="w-full rounded-xl border border-border"
            />
            <figcaption className="mt-1.5 text-xs text-muted-foreground">
              This is the screen you&apos;re looking for.
            </figcaption>
          </figure>
        )}
      </Step>

      <Step n={9} title="Pick your colour">
        Choose a colour from the row of dots. Your appointments show in this
        colour on the shared Team Calendar, so pick something nobody else has.
      </Step>

      <Step n={10} title="Click Connect calendar">
        Press the <Q>Connect calendar</Q> button (it says{" "}
        <Q>Update connection</Q> if you&apos;ve done this before).
        <Expect>
          The button changes to say <strong>Connected</strong>. That&apos;s it —
          you&apos;re finished.
        </Expect>
      </Step>

      {/* PART 3 */}
      <PartHeading n="Part 3" title="Check it worked" />

      <section className="rounded-2xl border border-border bg-card p-6">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Clock className="h-4 w-4 text-primary" />
          Don&apos;t panic if nothing appears straight away
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your appointments can take anywhere from <strong>15 minutes to a
          few hours</strong>{" "}to show up the first time. That is normal and does
          not mean you&apos;ve done it wrong. Go and do something else, then
          come back and open <Q>Calendar</Q> in the menu.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          When it&apos;s working, the Team Calendar will say{" "}
          <Q>1 member connected</Q> (or more), and your appointments appear in
          your colour.
        </p>
        <div className="mt-4">
          <Link
            href="/calendar"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold transition hover:bg-muted"
          >
            Open the Team Calendar
          </Link>
        </div>
      </section>

      {/* Stuck */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-base font-bold">If you get stuck</h2>
        <dl className="mt-4 space-y-4">
          <QA q="I can't find the three dots.">
            You have to hover the mouse over your calendar&apos;s name for them
            to appear. On a touchscreen laptop, try tapping and holding the
            name instead.
          </QA>
          <QA q="I'm on my phone and can't see any of this.">
            You can&apos;t do it in the Google Calendar app — the setting
            isn&apos;t in it. Open <Kbd>calendar.google.com</Kbd> in your phone&apos;s
            browser and switch on <Q>Desktop site</Q>, but honestly it&apos;s
            much easier on a computer.
          </QA>
          <QA q="I pasted it but it says the link isn't valid.">
            You&apos;ve probably copied the wrong one. Go back and make sure
            it&apos;s the <strong>Secret address in iCal format</strong>, and
            that it ends in <Kbd>.ics</Kbd> — not the &ldquo;public
            address&rdquo; or the calendar&apos;s email address.
          </QA>
          <QA q="It's been a day and still nothing.">
            Go back to Settings → Calendar and paste the link again. If it still
            doesn&apos;t work, send Paddy the message and he&apos;ll take a
            look — don&apos;t send him the link itself, it&apos;s private.
          </QA>
          <QA q="Will this put my bookings into Google?">
            No — that&apos;s the other direction and it&apos;s separate. This
            only brings your Google appointments <em>into</em>{" "}the portal.
          </QA>
        </dl>
        <Link
          href="/help/calendars"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
        >
          Read how the two directions differ
        </Link>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

function PartHeading({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
        {n}
      </span>
      <h2 className="text-lg font-black tracking-tight">{title}</h2>
    </div>
  );
}

function Step({
  n,
  title,
  icon: Icon = MousePointer2,
  children,
}: {
  n: number;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
      <div className="flex gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-base font-bold">
            <Icon className="h-4 w-4 shrink-0 text-primary" />
            {title}
          </h3>
          <div className="mt-2 text-sm leading-relaxed">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** What you should see after doing the step — reassurance you're on track. */
function Expect({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 flex gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
      <span>{children}</span>
    </p>
  );
}

function Danger({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 flex gap-2 rounded-lg border border-red-500/30 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/20 dark:text-red-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Quoted on-screen wording, so people know to look for exact text. */
function Q({ children }: { children: React.ReactNode }) {
  return <strong className="font-bold">&ldquo;{children}&rdquo;</strong>;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 text-[0.9em] font-semibold">
      {children}
    </code>
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

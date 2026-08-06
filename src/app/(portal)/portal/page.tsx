import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, GraduationCap, ArrowRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ParentEntries } from "@/components/portal/parent-entries";
import { coursesAreaVisible } from "@/lib/storefront";

export const dynamic = "force-dynamic";

/**
 * Parent portal home.
 *
 * This used to be a redirect straight to Training or Bookings, which meant
 * parents had no home screen at all — and nowhere to put anything that wasn't
 * a course or an appointment. It's now a real page: what's coming up, and
 * somewhere to jot down wins and questions between sessions.
 */
export default async function PortalHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Staff land on their own dashboard; this page is for parents.
  if (session.user.role !== "CLIENT") redirect("/dashboard");

  const firstName = (session.user.name ?? "").split(" ")[0] || "there";

  const [nextBooking, enrolment, coursesOn] = await Promise.all([
    prisma.booking.findFirst({
      where: {
        clientEmail: session.user.email ?? "",
        status: { not: "cancelled" },
        date: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
      },
      orderBy: { date: "asc" },
      select: { date: true, time: true, service: true, duration: true },
    }),
    prisma.enrollment.findFirst({
      where: { userId: session.user.id },
      select: { id: true, course: { select: { title: true, id: true } } },
    }),
    coursesAreaVisible(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <header>
        <h1 className="text-2xl font-black tracking-tight">Hello {firstName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your appointments, your courses, and somewhere to note things down
          between sessions.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/portal/bookings"
          className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40"
        >
          <p className="flex items-center gap-2 text-sm font-bold">
            <CalendarDays className="h-4 w-4 text-primary" />
            Next appointment
          </p>
          {nextBooking ? (
            <>
              <p className="mt-2 text-lg font-bold">
                {nextBooking.date.toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "Europe/London",
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {nextBooking.time} · {nextBooking.duration}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing booked at the moment. Tap to book a session.
            </p>
          )}
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
            See all bookings <ArrowRight className="h-3 w-3" />
          </span>
        </Link>

        {coursesOn && (
          <Link
            href="/portal/training"
            className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40"
          >
            <p className="flex items-center gap-2 text-sm font-bold">
              <GraduationCap className="h-4 w-4 text-primary" />
              Your training
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {enrolment
                ? `Carry on with ${enrolment.course.title}.`
                : "Browse the courses available to you."}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
              Open training <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        )}
      </div>

      <div className="rounded-2xl bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
        Anything you add below is saved to your child&apos;s record and read by
        your therapist before your next session. It isn&apos;t a message
        service — if something needs an answer quickly, please ring or email
        the practice.
      </div>

      <ParentEntries />
    </div>
  );
}

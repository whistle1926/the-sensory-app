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
    <div className="mx-auto max-w-5xl space-y-8 pb-16">
      <header>
        <p className="inline-flex items-center gap-2 rounded-full border-2 border-[#F3DFA6] bg-[#FFF3D2] px-3 py-1 text-[13px] font-bold uppercase tracking-[1.2px]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#17B0A7]" aria-hidden />
          Your portal
        </p>
        <h1 className="sub-display mt-4 text-[34px] leading-[1.05] tracking-[-1px] sm:text-[44px]">
          Hello {firstName}
        </h1>
        <p className="mt-3 max-w-[560px] text-[16px] font-semibold leading-relaxed text-[#3D4A6B]">
          Your appointments, your courses, and somewhere to note things down
          between sessions.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        <Link
          href="/portal/bookings"
          className="sub-edge sub-press flex flex-col rounded-[26px] bg-white p-6"
        >
          <p className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-[#12235B] bg-[#E7F6F4]">
              <CalendarDays className="h-4 w-4 text-[#12235B]" />
            </span>
            <span className="sub-display text-[19px]">Next appointment</span>
          </p>
          {nextBooking ? (
            <>
              <p className="sub-display mt-4 text-2xl leading-tight">
                {nextBooking.date.toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "Europe/London",
                })}
              </p>
              <p className="mt-1 text-[15px] font-semibold text-[#6B7794]">
                {nextBooking.time} · {nextBooking.duration}
              </p>
            </>
          ) : (
            <p className="mt-4 text-[15px] font-semibold leading-relaxed text-[#3D4A6B]">
              Nothing booked at the moment. Tap to book a session.
            </p>
          )}
          <span className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-extrabold text-[#E71D57]">
            See all bookings <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        {coursesOn && (
          <Link
            href="/portal/training"
            className="sub-edge sub-press flex flex-col rounded-[26px] bg-white p-6"
          >
            <p className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-[#12235B] bg-[#FFF3D2]">
                <GraduationCap className="h-4 w-4 text-[#12235B]" />
              </span>
              <span className="sub-display text-[19px]">Your training</span>
            </p>
            <p className="mt-4 text-[15px] font-semibold leading-relaxed text-[#3D4A6B]">
              {enrolment
                ? `Carry on with ${enrolment.course.title}.`
                : "Browse the courses available to you."}
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-extrabold text-[#E71D57]">
              Open training <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        )}
      </div>

      <div className="rounded-[22px] border-2 border-[#F3DFA6] bg-[#FFF3D2] p-5 text-[14px] font-semibold leading-relaxed text-[#3D4A6B]">
        Anything you add below is saved to your child&apos;s record and read by
        your therapist before your next session. It isn&apos;t a message
        service — if something needs an answer quickly, please ring or email
        the practice.
      </div>

      <ParentEntries />
    </div>
  );
}

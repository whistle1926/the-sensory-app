import { ArrowUpRight, BadgeCheck, Check } from "lucide-react";
import type { PartnerCourse } from "@/lib/partner-course";

/**
 * Promo card for a course that lives outside this app (currently The Little
 * Sensory Explorers CPD training, run as a partnership and sold on its own
 * site).
 *
 * Deliberately styled as a *referral*, not as one of the portal's own
 * courses: no progress bar, no "start learning", and the CTA opens the
 * partner site in a new tab. That keeps it honest — parents shouldn't click
 * expecting it to open inside the portal like their enrolled courses do.
 */
export function PartnerCourseCard({ course }: { course: PartnerCourse }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-sm)]">
      <div className="grid gap-0 md:grid-cols-[1.4fr_1fr]">
        <div className="p-6 sm:p-8">
          {course.eyebrow && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
              <BadgeCheck className="h-3.5 w-3.5" />
              {course.eyebrow}
            </p>
          )}

          <h2 className="mt-3 text-xl font-black tracking-tight sm:text-2xl">
            {course.title}
          </h2>

          {course.blurb && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {course.blurb}
            </p>
          )}

          {course.bullets.length > 0 && (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {course.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href={course.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90"
            >
              {course.ctaLabel}
              <ArrowUpRight className="h-4 w-4" />
            </a>
            {course.price && (
              <span className="text-sm font-semibold text-muted-foreground">
                {course.price}
              </span>
            )}
          </div>

          {/* Set expectations before the click — this leaves the portal. */}
          <p className="mt-3 text-xs text-muted-foreground">
            Opens The Little Sensory Explorers website in a new tab. Booking and
            payment are handled there, separately from your portal account.
          </p>
        </div>

        <div
          className="relative hidden min-h-[220px] bg-gradient-to-br from-primary/15 via-primary/5 to-transparent md:block"
          aria-hidden
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-32 w-32 items-center justify-center rounded-[36px] bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-[var(--shadow-lg)]">
              <BadgeCheck className="h-14 w-14" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

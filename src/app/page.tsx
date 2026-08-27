import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { SubmarineHeader } from "@/components/storefront/submarine-header";
import {
  SubmarineCourseCard,
  type SubCourse,
} from "@/components/storefront/submarine-course-card";

export const dynamic = "force-dynamic";

/**
 * Public landing page.
 *
 *   - Signed-in staff → /dashboard
 *   - Signed-in CLIENT → /portal (which sends them on to training or
 *                                 bookings depending on what they have)
 *   - Visitors → the marketing home.
 *
 * Wears the Submarine treatment from the Pages 1 & 3 redesign: cream
 * ground, chunky navy outlines, hard offset shadows, Baloo headings.
 * The shared styles live under `.sub` in globals.css.
 */
export default async function Home() {
  const session = await auth();
  if (session?.user) {
    if (session.user.role === "CLIENT") redirect("/portal");
    redirect("/dashboard");
  }

  // Admin-controlled visibility for the public Courses link, the sign-in
  // and create-account links, and every courses-related section below.
  // Read once on render so the server HTML matches what the header shows.
  const storefrontConfig = await prisma.storefrontConfig.findUnique({
    where: { id: "default" },
    select: {
      showCoursesNav: true,
      showSignIn: true,
      showCreateAccount: true,
      testimonials: true,
    },
  });
  const testimonials = Array.isArray(storefrontConfig?.testimonials)
    ? (storefrontConfig.testimonials as Array<{
        quote: string;
        author: string;
        meta?: string;
      }>)
    : [];
  const showCoursesNav = storefrontConfig?.showCoursesNav ?? true;
  const showSignIn = storefrontConfig?.showSignIn ?? true;
  const showCreateAccount = storefrontConfig?.showCreateAccount ?? true;

  const allCourses = await prisma.course.findMany({
    where: { status: "AVAILABLE" },
    orderBy: [
      { isFeatured: "desc" },
      { isBestseller: "desc" },
      { order: "asc" },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      slug: true,
      title: true,
      tagline: true,
      shortDescription: true,
      duration: true,
      price: true,
      thumbnailUrl: true,
      heroImageUrl: true,
      isBestseller: true,
      accreditationBadges: true,
      _count: { select: { modules: true } },
    },
  });

  const featured = allCourses.slice(0, 6);
  const totalAvailable = allCourses.length;

  // The tilted cards beside the headline. While Courses is switched off in
  // Settings the hero must not advertise them, so it falls back to the two
  // things that are always on sale.
  const heroCards: {
    key: string;
    href: string;
    title: string;
    meta: string;
    image: string | null;
    stripe: string;
    accent: string;
  }[] = showCoursesNav
    ? allCourses.slice(0, 2).map((c) => ({
        key: c.id,
        href: `/courses/${c.slug}`,
        title: c.title,
        meta:
          c._count.modules > 0
            ? `${c._count.modules} module${c._count.modules === 1 ? "" : "s"} · self-paced`
            : c.duration,
        image: c.thumbnailUrl ?? c.heroImageUrl,
        stripe: "#FFE9A8",
        accent: "#FFC93C",
      }))
    : [
        {
          key: "sessions",
          href: "/book",
          title: "1:1 sessions with Grace",
          meta: "Assessment and therapy · in person or online",
          image: null,
          stripe: "#FFE9A8",
          accent: "#E71D57",
        },
        {
          key: "programmes",
          href: "/book",
          title: "Home programmes",
          meta: "A plan built round your day",
          image: null,
          stripe: "#FFE1EA",
          accent: "#17B0A7",
        },
      ];

  const allBadges = Array.from(
    new Set(allCourses.flatMap((c) => c.accreditationBadges ?? [])),
  ).slice(0, 8);

  const ctaPrimary =
    "sub-edge-lg sub-press inline-flex items-center rounded-full px-7 py-4 text-[17px] font-extrabold text-white";
  const ctaSecondary =
    "sub-edge-lg sub-press inline-flex items-center rounded-full bg-white px-7 py-4 text-[17px] font-extrabold text-[#12235B]";

  return (
    <div className="sub min-h-screen">
      <SubmarineHeader />

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-5 py-14 sm:px-10 sm:py-[72px]">
        <div className="sub-dots pointer-events-none absolute inset-0 opacity-90" aria-hidden />
        <div
          className="pointer-events-none absolute -right-[120px] -top-[140px] h-[520px] w-[520px] rounded-full bg-[#FFE9A8]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-[180px] -left-[140px] h-[420px] w-[420px] rounded-full bg-[#FFE1EA]"
          aria-hidden
        />

        <div className="relative mx-auto grid max-w-[1240px] items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
          <div>
            <p className="sub-edge inline-flex items-center gap-2.5 rounded-full bg-white py-2 pl-2.5 pr-4 text-[13px] font-extrabold uppercase tracking-[1.4px]">
              <span className="h-[22px] w-[22px] rounded-full bg-[#17B0A7]" aria-hidden />
              Paediatric OT · Northern Ireland
            </p>

            <h1 className="sub-display mt-6 text-[44px] leading-[1.02] tracking-[-1.2px] text-pretty sm:text-[60px] lg:text-[76px] lg:tracking-[-1.8px]">
              Practical support for{" "}
              <span className="relative inline-block">
                <span
                  className="absolute -left-2.5 -right-2.5 bottom-[8%] top-[12%] rounded-full bg-[#FFC93C]"
                  aria-hidden
                />
                <span className="relative">children</span>
              </span>{" "}
              <span className="text-[#E71D57]">&amp; families</span>
            </h1>

            <p className="mt-6 max-w-[560px] text-[17px] leading-[1.65] text-pretty text-[#3D4A6B] sm:text-[19px]">
              Evidence-based Occupational Therapy from Paediatric OT Grace
              Magennis — courses, 1:1 sessions and home programmes that build
              real skills and confidence, at home, at school and out in the
              world.
            </p>

            <div className="mt-8 flex flex-wrap gap-3.5">
              <Link
                href="/book"
                className={ctaPrimary}
                style={{ background: "var(--sub-pink)" }}
              >
                Book a 1:1 session
              </Link>
              {showCoursesNav && (
                <Link href="#courses" className={ctaSecondary}>
                  Browse the courses
                </Link>
              )}
            </div>

            <div className="mt-9 flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-2.5 rounded-full border-2 border-[#C2E7E3] bg-[#E7F6F4] px-4 py-2.5 text-sm font-bold">
                <span className="h-3 w-3 rounded-full bg-[#17B0A7]" aria-hidden />
                OT-led, evidence-based
              </span>
              <span className="inline-flex items-center gap-2.5 rounded-full border-2 border-[#F3DFA6] bg-[#FFF3D2] px-4 py-2.5 text-sm font-bold">
                <span className="h-3 w-3 rounded-full bg-[#FFC93C]" aria-hidden />
                CPD hours for practitioners
              </span>
              <span className="inline-flex items-center gap-2.5 rounded-full border-2 border-[#FBC7D7] bg-[#FFE7EE] px-4 py-2.5 text-sm font-bold">
                <span className="h-3 w-3 rounded-full bg-[#E71D57]" aria-hidden />
                Loved by parents
              </span>
            </div>
          </div>

          {/* The stack of tilted cards. Hidden on small screens, where it
              would push the buttons off the first screenful. */}
          <div className="relative hidden min-h-[720px] lg:block">
            <div
              className="absolute left-6 top-[30px] h-[300px] w-[300px] rounded-full bg-[#FFC93C]"
              aria-hidden
            />
            <div
              className="absolute bottom-[110px] right-2 h-[190px] w-[190px] rounded-full bg-[#17B0A7] opacity-[.35]"
              aria-hidden
            />

            {heroCards.map((card, i) => (
              <Link
                key={card.key}
                href={card.href}
                className={`sub-bob absolute w-[300px] rounded-[26px] border-[3px] border-[#12235B] bg-white p-3 shadow-[6px_6px_0_#12235B] ${
                  i === 0 ? "right-10 top-2.5" : "left-0 top-[296px] w-[280px]"
                }`}
                style={{
                  ["--sub-tilt" as string]: i === 0 ? "rotate(6deg)" : "rotate(-7deg)",
                  transform: i === 0 ? "rotate(6deg)" : "rotate(-7deg)",
                  ...(i === 1
                    ? { animationDuration: "8.5s", animationDelay: ".6s" }
                    : {}),
                }}
              >
                <span
                  className="flex items-center justify-center overflow-hidden rounded-2xl"
                  style={{
                    height: i === 0 ? 168 : 150,
                    background: `repeating-linear-gradient(135deg, ${card.stripe} 0 10px, #FFF8EC 10px 20px)`,
                  }}
                >
                  {card.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={card.image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    /* No picture to show — a shape from the same family,
                       so it reads as decoration rather than a gap. */
                    <span
                      className="h-[60px] w-[60px] rounded-[20px] border-[3px] border-[#12235B]"
                      style={{ background: card.accent }}
                    />
                  )}
                </span>
                <span className="sub-display mx-1 mb-1 mt-3 block text-[19px] leading-tight">
                  {card.title}
                </span>
                <span className="mx-1 mb-2 block text-sm font-bold text-[#6B7794]">
                  {card.meta}
                </span>
              </Link>
            ))}

            {/* A picture of the platform itself, not a claim about anyone's
                progress — so no invented numbers on it. */}
            <div
              className="sub-bob absolute bottom-0 right-0 w-[320px] rounded-[26px] border-[3px] border-[#12235B] bg-[#12235B] px-6 py-5 text-white shadow-[6px_6px_0_#E71D57]"
              style={{
                ["--sub-tilt" as string]: "rotate(3deg)",
                transform: "rotate(3deg)",
                animationDuration: "9.5s",
                animationDelay: "1.2s",
              }}
              aria-hidden
            >
              <div className="flex items-center gap-3">
                <span className="h-11 w-11 shrink-0 rounded-full border-[3px] border-white bg-[#FFC93C]" />
                <div>
                  <p className="sub-display text-xl">Welcome aboard!</p>
                  <p className="text-sm font-bold text-[#C6D0EA]">
                    Your plan, in one place
                  </p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,.22)]">
                <div className="h-full w-[62%] rounded-full bg-[#17B0A7]" />
              </div>
              <p className="mt-2.5 text-[13px] font-bold text-[#C6D0EA]">
                Work through it at your own pace
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Three ways in ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-t-[48px] bg-[#12235B] px-5 py-16 sm:px-10 sm:py-[76px]">
        <span
          className="sub-bubble absolute bottom-0 left-[6%] h-4 w-4 rounded-full bg-[rgba(255,255,255,.3)]"
          aria-hidden
        />
        <span
          className="sub-bubble absolute bottom-0 left-[42%] h-2.5 w-2.5 rounded-full bg-[rgba(255,255,255,.3)]"
          style={{ animationDuration: "7.5s", animationDelay: "1s" }}
          aria-hidden
        />
        <span
          className="sub-bubble absolute bottom-0 left-[78%] h-3 w-3 rounded-full bg-[rgba(255,255,255,.3)]"
          style={{ animationDuration: "8s", animationDelay: "2s" }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-[1240px]">
          <h2 className="sub-display text-[34px] tracking-[-.8px] text-white sm:text-[46px]">
            {showCoursesNav
              ? "Three ways we dive in with you"
              : "How we dive in with you"}
          </h2>
          <p className="mb-11 mt-3 text-[17px] font-bold text-[#C6D0EA] sm:text-[18px]">
            Pick the support that fits your family — or mix all three.
          </p>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Courses",
                body: "Self-paced modules for parents and practitioners. Re-watch anytime, download the handouts, collect CPD hours.",
                cta: "Browse courses →",
                href: "#courses",
                colour: "#FFC93C",
                show: showCoursesNav,
              },
              {
                title: "1:1 sessions",
                body: "Assessment and hands-on therapy with Grace and our associate OTs, in person or online. Clear goals, plain-English reports.",
                cta: "Book a session →",
                href: "/book",
                colour: "#E71D57",
                show: true,
              },
              {
                title: "Home programmes",
                body: "A personalised plan you can actually keep up with — short activities, kept up to date after every session.",
                cta: "See how it works →",
                href: "/book",
                colour: "#17B0A7",
                show: true,
              },
            ]
              .filter((c) => c.show)
              .map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className="sub-press flex flex-col rounded-[30px] border-[3px] border-[#0A1740] bg-[#FFF8EC] p-7"
                  style={{ boxShadow: `8px 8px 0 ${card.colour}` }}
                >
                  <span
                    className="mb-5 h-[60px] w-[60px] rounded-[20px] border-[3px] border-[#12235B]"
                    style={{ background: card.colour }}
                    aria-hidden
                  />
                  <span className="sub-display text-[26px]">{card.title}</span>
                  <span className="mb-4 mt-2 block text-base leading-relaxed text-[#3D4A6B]">
                    {card.body}
                  </span>
                  <span className="mt-auto text-[15px] font-extrabold text-[#E71D57]">
                    {card.cta}
                  </span>
                </Link>
              ))}
          </div>
        </div>
      </section>

      {/* ── Courses ────────────────────────────────────────────────── */}
      {showCoursesNav && (
        <section
          id="courses"
          className="scroll-mt-24 px-5 py-16 sm:px-10 sm:py-20"
        >
          <div className="mx-auto max-w-[1240px]">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-[13px] font-extrabold uppercase tracking-[1.4px] text-[#E71D57]">
                  Online learning
                </p>
                <h2 className="sub-display mt-2 text-[34px] tracking-[-.8px] sm:text-[46px]">
                  Courses for parents and practitioners
                </h2>
                <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-[#3D4A6B]">
                  Evidence-based mini-courses built around what actually helps
                  at home. Start with a free taster or go deep.
                </p>
              </div>
              {totalAvailable > featured.length && (
                <Link
                  href="/courses"
                  className="sub-edge sub-press rounded-full bg-white px-5 py-3 text-[15px] font-extrabold"
                >
                  See all {totalAvailable} →
                </Link>
              )}
            </div>

            {featured.length === 0 ? (
              <div className="rounded-[30px] border-[3px] border-dashed border-[#12235B]/30 bg-white p-12 text-center">
                <p className="sub-display text-2xl">
                  Courses are being prepared
                </p>
                <p className="mt-2 text-[15px] font-semibold text-[#6B7794]">
                  Check back soon — or book a 1:1 session in the meantime.
                </p>
              </div>
            ) : (
              <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((course) => (
                  <SubmarineCourseCard
                    key={course.id}
                    course={course as SubCourse}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── What families say ─────────────────────────────────────────
          Real reviews, edited in Settings → Storefront so Grace can change
          them without a deploy. The section disappears when there are
          none rather than showing a placeholder. */}
      {testimonials.length > 0 && (
        <section className="px-5 pb-4 sm:px-10">
          <div className="mx-auto max-w-[1000px]">
            <h2 className="sub-display text-center text-[34px] tracking-[-.8px] sm:text-[46px]">
              What families say
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {testimonials.slice(0, 4).map((t, i) => (
                <blockquote
                  key={i}
                  className="sub-edge-lg rounded-[30px] bg-white p-7"
                >
                  <p
                    className="sub-display text-[40px] leading-[0] text-[#FFC93C]"
                    aria-hidden
                  >
                    &ldquo;
                  </p>
                  <p className="mt-4 whitespace-pre-line text-[17px] leading-relaxed">
                    {t.quote}
                  </p>
                  <footer className="mt-4 text-[15px] font-bold text-[#6B7794]">
                    <span className="text-[#12235B]">{t.author}</span>
                    {t.meta ? ` — ${t.meta}` : ""}
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Accreditation ──────────────────────────────────────────── */}
      {allBadges.length > 0 && (
        <section className="px-5 py-14 sm:px-10">
          <div className="mx-auto max-w-[1240px]">
            <p className="text-center text-[13px] font-extrabold uppercase tracking-[1.4px] text-[#6B7794]">
              Trusted, accredited, evidence-based
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-8">
              {allBadges.map((url, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="h-12 w-auto"
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Bottom CTA ─────────────────────────────────────────────── */}
      <section className="px-5 pb-16 sm:px-10 sm:pb-20">
        <div className="sub-edge-xl mx-auto max-w-[900px] rounded-[36px] bg-white p-8 text-center sm:p-12">
          <h2 className="sub-display text-[32px] tracking-[-.8px] sm:text-[40px]">
            Not sure where to start?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-[#3D4A6B]">
            Book a short initial consultation and we&apos;ll help you find the
            right next step for your child — whether that&apos;s a course, a
            home programme, or something else.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3.5">
            <Link
              href="/book"
              className={ctaPrimary}
              style={{ background: "var(--sub-pink)" }}
            >
              Book a session
            </Link>
            {showCoursesNav && (
              <Link href="/courses" className={ctaSecondary}>
                See all courses
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t-2 border-[#F2E4CD] px-5 py-8 sm:px-10">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 text-[15px] font-bold text-[#6B7794]">
          <p>© {new Date().getFullYear()} The Sensory Submarine</p>
          <div className="flex flex-wrap items-center gap-5">
            {showCoursesNav && (
              <Link href="/courses" className="hover:text-[#12235B]">
                Courses
              </Link>
            )}
            <Link href="/book" className="hover:text-[#12235B]">
              Book a session
            </Link>
            <Link href="/resources" className="hover:text-[#12235B]">
              Free resources
            </Link>
            {showSignIn && (
              <Link href="/login" className="hover:text-[#12235B]">
                Sign in
              </Link>
            )}
            {showCreateAccount && (
              <Link href="/register" className="hover:text-[#12235B]">
                Create account
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

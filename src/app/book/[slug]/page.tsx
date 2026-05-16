/**
 * Per-service deep-link landing page. Hits at /book/[slug] — e.g.
 * /book/face-to-face-ot-assessment — and renders a focused page for
 * that single service, with a single CTA into the booking flow.
 *
 * Used by:
 *   • Ad campaigns (point Meta/Google directly at the service URL).
 *   • Admin "Copy link" buttons in the Services tab.
 *   • Inline references in marketing emails / WhatsApp messages.
 *
 * 404s for unknown / inactive slugs so a paused service can't be
 * booked. The CTA forwards to `/book?service=<slug>` which the main
 * /book page reads to pre-select step 1 → straight onto the calendar.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StorefrontHeader } from "@/components/courses/storefront-header";
import { ArrowRight, CheckCircle2, Clock, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ServiceLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = await prisma.bookingService.findUnique({
    where: { slug },
  });
  if (!service || !service.isActive) notFound();

  const priceLabel =
    service.pricePence === 0
      ? "Free / on enquiry"
      : `£${(service.pricePence / 100).toFixed(
          service.pricePence % 100 === 0 ? 0 : 2,
        )}`;
  const depositLabel =
    service.depositPence > 0
      ? `£${(service.depositPence / 100).toFixed(0)} non-refundable deposit`
      : null;

  return (
    <div className="min-h-screen bg-[#FBF8F3]">
      <StorefrontHeader />

      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
          {service.category && (
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
              {service.category}
            </p>
          )}
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
            {service.title}
          </h1>
          {service.tagline && (
            <p className="mt-3 text-lg text-muted-foreground">
              {service.tagline}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-white p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xl font-bold tracking-tight">
                {priceLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{service.durationLabel}</span>
            </div>
            {depositLabel && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                {depositLabel}
              </span>
            )}
            <Link
              href={`/book?service=${encodeURIComponent(service.slug)}`}
              className="ml-auto inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] hover:brightness-110"
            >
              Book this session
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {service.description && (
            <div className="mt-10 rounded-2xl border border-border bg-white p-6 shadow-[var(--shadow-sm)] sm:p-8">
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
                What&rsquo;s included
              </h2>
              <div className="mt-3 whitespace-pre-line text-base leading-relaxed">
                {service.description}
              </div>
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-6">
            <div>
              <p className="text-sm font-bold">Ready to book?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick a date and time on the next screen — payment processed
                securely. T&amp;Cs are agreed to as part of the booking flow.
              </p>
            </div>
            <Link
              href={`/book?service=${encodeURIComponent(service.slug)}`}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-sm)] transition-all hover:brightness-110"
            >
              <CheckCircle2 className="h-4 w-4" />
              Continue to booking
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

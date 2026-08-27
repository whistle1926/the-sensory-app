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
import { SubmarineHeader } from "@/components/storefront/submarine-header";
import { SubmarineFooter } from "@/components/storefront/submarine-footer";
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
    <div className="sub min-h-screen">
      <SubmarineHeader />

      <section className="relative overflow-hidden">
        <div className="sub-dots pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-5 py-14 sm:py-20">
          {service.category && (
            <p className="text-[13px] font-extrabold uppercase tracking-[1.4px] text-[#E71D57]">
              {service.category}
            </p>
          )}
          <h1 className="sub-display mt-3 text-[38px] leading-[1.05] tracking-[-1.2px] sm:text-[52px]">
            {service.title}
          </h1>
          {service.tagline && (
            <p className="mt-3 text-lg font-semibold text-[#3D4A6B]">
              {service.tagline}
            </p>
          )}

          <div className="sub-edge-lg mt-7 flex flex-wrap items-center gap-4 rounded-[26px] bg-white p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#E71D57]" />
              <span className="sub-display text-2xl">
                {priceLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[15px] font-bold text-[#6B7794]">
              <Clock className="h-4 w-4" />
              <span>{service.durationLabel}</span>
            </div>
            {depositLabel && (
              <span className="rounded-full border-2 border-[#F3DFA6] bg-[#FFF3D2] px-3 py-1.5 text-[13px] font-bold">
                {depositLabel}
              </span>
            )}
            <Link
              href={`/book?service=${encodeURIComponent(service.slug)}`}
              className="sub-edge sub-press ml-auto inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-extrabold text-white"
              style={{ background: "var(--sub-pink)" }}
            >
              Book this session
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {service.description && (
            <div className="sub-edge mt-10 rounded-[26px] bg-white p-6 sm:p-8">
              <h2 className="sub-display text-2xl">What&rsquo;s included</h2>
              <div className="mt-3 whitespace-pre-line text-base leading-relaxed text-[#3D4A6B]">
                {service.description}
              </div>
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-[26px] border-[3px] border-[#F3DFA6] bg-[#FFF3D2] p-6">
            <div>
              <p className="sub-display text-xl">Ready to book?</p>
              <p className="mt-1 max-w-lg text-[13px] font-semibold text-[#6B7794]">
                Pick a date and time on the next screen — payment processed
                securely. T&amp;Cs are agreed to as part of the booking flow.
              </p>
            </div>
            <Link
              href={`/book?service=${encodeURIComponent(service.slug)}`}
              className="sub-edge sub-press inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-extrabold text-white"
              style={{ background: "var(--sub-pink)" }}
            >
              <CheckCircle2 className="h-4 w-4" />
              Continue to booking
            </Link>
          </div>
        </div>
      </section>

      <SubmarineFooter />
    </div>
  );
}

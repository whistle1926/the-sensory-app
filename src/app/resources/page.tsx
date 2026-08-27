import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ResourceList } from "@/components/resources/resource-list";
import { BundleSignup } from "@/components/resources/bundle-signup";
import { SubmarineHeader } from "@/components/storefront/submarine-header";
import { SubmarineFooter } from "@/components/storefront/submarine-footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Free resources — The Sensory Submarine",
  description:
    "Free printable activity sheets and handouts from a paediatric occupational therapist.",
};

/**
 * The free downloads page.
 *
 * Public and unauthenticated: a parent who has to make an account before
 * they can print an activity sheet doesn't print the activity sheet. The
 * only thing asked for is an email address, and the file is sent to it.
 */
export default async function FreeResourcesPage() {
  const resources = await prisma.freeResource.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      thumbnailUrl: true,
    },
  });

  return (
    <div className="sub min-h-screen">
      <SubmarineHeader />

      <main className="relative overflow-hidden px-5 py-12 sm:px-10 sm:pb-24">
        <div className="sub-dots pointer-events-none absolute inset-0" aria-hidden />
        <div
          className="pointer-events-none absolute -right-[110px] -top-[150px] h-[440px] w-[440px] rounded-full bg-[#FFE1EA]"
          aria-hidden
        />

        <div className="relative mx-auto max-w-[1140px]">
          <div className="mb-14 grid items-center gap-11 lg:grid-cols-[1.05fr_.95fr]">
            <div>
              <p className="sub-edge inline-block rounded-full bg-[#FFC93C] px-4 py-2 text-xs font-extrabold uppercase tracking-[1.4px]">
                Free to download
              </p>
              <h1 className="sub-display mt-6 text-[40px] leading-[1.05] tracking-[-1.2px] sm:text-[60px] sm:tracking-[-1.6px]">
                Activity sheets &amp; handouts
              </h1>
              <p className="mt-4 max-w-[520px] text-[17px] font-semibold leading-[1.65] text-[#3D4A6B] sm:text-[18px]">
                Practical things you can print and use at home, put together by
                a paediatric occupational therapist. Tell us where to send it
                and it&apos;s yours — no account needed.
              </p>
            </div>

            {/* Only worth offering when there's actually a bundle to send. */}
            {resources.length > 0 && <BundleSignup count={resources.length} />}
          </div>

          {resources.length === 0 ? (
            <p className="sub-edge-lg rounded-[28px] bg-white p-10 text-center text-[17px] font-semibold text-[#6B7794]">
              Nothing here just yet — check back soon.
            </p>
          ) : (
            <>
              <ResourceList resources={resources} />

              <div className="mt-9 flex items-center gap-6 rounded-[28px] border-[3px] border-dashed border-[#D9C9AA] bg-white px-7 py-6">
                <span
                  className="h-[52px] w-[52px] shrink-0 rounded-full border-[3px] border-[#12235B] bg-[#FFC93C]"
                  aria-hidden
                />
                <div>
                  <p className="sub-display text-[22px]">
                    More sheets on the way
                  </p>
                  <p className="text-[15px] font-semibold text-[#6B7794]">
                    New handouts are added regularly — join the bundle list
                    above and they&apos;ll come to you.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <SubmarineFooter />
    </div>
  );
}

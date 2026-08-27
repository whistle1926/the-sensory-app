import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ResourceList } from "@/components/resources/resource-list";

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
    <div className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
      <header className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">
          Free to download
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          Activity sheets and handouts
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Practical things you can print and use at home, put together by a
          paediatric occupational therapist. Tell us where to send it and
          it&apos;s yours — no account needed.
        </p>
      </header>

      {resources.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nothing here just yet — check back soon.
        </p>
      ) : (
        <ResourceList resources={resources} />
      )}
    </div>
  );
}

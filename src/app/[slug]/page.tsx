import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanBlocks } from "@/lib/page-blocks";
import { PageBlocksView } from "@/components/pages/page-blocks-view";
import { SubmarineHeader } from "@/components/storefront/submarine-header";

export const dynamic = "force-dynamic";

/**
 * An editable page at a clean URL — /about rather than /p/about.
 *
 * This is a root catch-all, but Next resolves static routes first, so every
 * real area of the app (/dashboard, /courses, /book…) still wins. Anything
 * left over is looked up as a page, and 404s if there isn't one.
 */
async function load(slug: string) {
  return prisma.page.findUnique({ where: { slug } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) return {};
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || undefined,
  };
}

export default async function EditablePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) notFound();

  // Staff can check an unpublished page; everyone else gets a 404.
  const session = await auth();
  const isStaff =
    session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "TEAM_MANAGER";
  if (!page.isPublished && !isStaff) notFound();

  return (
    <div className="sub min-h-screen">
      {!page.isPublished && (
        <div className="border-b border-amber-500/40 bg-amber-100 px-4 py-2.5 text-center text-sm text-amber-900">
          <strong>Preview</strong>{" "}— this page isn&apos;t published, so nobody
          else can see it yet.
        </div>
      )}
      <SubmarineHeader />
      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <PageBlocksView blocks={cleanBlocks(page.blocks)} />
      </main>
    </div>
  );
}

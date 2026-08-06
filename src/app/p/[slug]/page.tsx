import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanBlocks } from "@/lib/page-blocks";
import { PageBlocksView } from "@/components/pages/page-blocks-view";
import { StorefrontHeader } from "@/components/courses/storefront-header";

export const dynamic = "force-dynamic";

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

export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) notFound();

  // Staff can see an unpublished page so it can be checked before going live;
  // everyone else gets a 404, exactly as with an unpublished course.
  const session = await auth();
  const isStaff =
    session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "TEAM_MANAGER";
  if (!page.isPublished && !isStaff) notFound();

  const blocks = cleanBlocks(page.blocks);

  return (
    <div className="min-h-screen bg-[#FBF8F3]">
      {!page.isPublished && (
        <div className="border-b border-amber-500/40 bg-amber-100 px-4 py-2.5 text-center text-sm text-amber-900">
          <strong>Preview</strong> — this page isn&apos;t published, so nobody
          else can see it yet.
        </div>
      )}
      <StorefrontHeader />
      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <PageBlocksView blocks={blocks} />
      </main>
    </div>
  );
}

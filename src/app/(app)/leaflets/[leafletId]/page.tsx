import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/components/leaflets/print-button";

export default async function LeafletViewPage({
  params,
}: {
  params: Promise<{ leafletId: string }>;
}) {
  const { leafletId } = await params;
  const leaflet = await prisma.leaflet.findUnique({ where: { id: leafletId } });
  if (!leaflet) notFound();

  // For file/link leaflets, redirect to the URL rather than render (there's
  // nothing to display in-app beyond the link).
  if (leaflet.kind !== "content" && leaflet.fileUrl) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link
          href="/leaflets"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to leaflets
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
          <h1 className="text-xl font-bold">{leaflet.title}</h1>
          {leaflet.description && (
            <p className="mt-2 text-sm text-muted-foreground">
              {leaflet.description}
            </p>
          )}
          <a
            href={leaflet.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            Open {leaflet.kind === "link" ? "external link" : "file"}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/leaflets"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to leaflets
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/leaflets?edit=${leaflet.id}`}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
          <PrintButton />
        </div>
      </div>

      <article className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)] md:p-10 print:border-0 print:shadow-none">
        {leaflet.category && (
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {leaflet.category}
          </p>
        )}
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {leaflet.title}
        </h1>
        {leaflet.description && (
          <p className="mt-2 text-lg text-muted-foreground">
            {leaflet.description}
          </p>
        )}
        <div
          className="prose prose-sm mt-6 max-w-none dark:prose-invert prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-primary"
          dangerouslySetInnerHTML={{ __html: leaflet.content ?? "" }}
        />
      </article>
    </div>
  );
}


import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  LeafletForm,
  type LeafletKind,
} from "@/components/leaflets/leaflet-form";

export default async function EditLeafletPage({
  params,
}: {
  params: Promise<{ leafletId: string }>;
}) {
  const { leafletId } = await params;

  const [leaflet, existing] = await Promise.all([
    prisma.leaflet.findUnique({ where: { id: leafletId } }),
    prisma.leaflet.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"],
    }),
  ]);

  if (!leaflet) notFound();

  const suggestedCategories = existing
    .map((l) => l.category)
    .filter((c): c is string => !!c)
    .sort();

  return (
    <LeafletForm
      leafletId={leaflet.id}
      initial={{
        id: leaflet.id,
        title: leaflet.title,
        description: leaflet.description ?? "",
        category: leaflet.category ?? "",
        kind: (leaflet.kind as LeafletKind) ?? "file",
        content: leaflet.content,
        coverImageUrl: leaflet.coverImageUrl,
        fileUrl: leaflet.fileUrl,
        fileName: leaflet.fileName,
        mimeType: leaflet.mimeType,
        sizeBytes: leaflet.sizeBytes,
      }}
      suggestedCategories={suggestedCategories}
    />
  );
}

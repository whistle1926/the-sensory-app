import { prisma } from "@/lib/prisma";
import { LeafletForm } from "@/components/leaflets/leaflet-form";

export default async function NewLeafletPage() {
  // Pre-fetch existing categories so the datalist has suggestions from the
  // first keystroke — otherwise the user would have to type a category fresh
  // every time even though they almost always reuse one of ~7.
  const existing = await prisma.leaflet.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ["category"],
  });
  const suggestedCategories = existing
    .map((l) => l.category)
    .filter((c): c is string => !!c)
    .sort();

  return (
    <LeafletForm
      initial={{
        title: "",
        description: "",
        category: "",
        kind: "content",
      }}
      suggestedCategories={suggestedCategories}
    />
  );
}

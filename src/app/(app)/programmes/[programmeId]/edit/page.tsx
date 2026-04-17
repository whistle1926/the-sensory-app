import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProgrammeForm, type Section } from "@/components/programmes/programme-form";

export default async function EditProgrammePage({
  params,
}: {
  params: Promise<{ programmeId: string }>;
}) {
  const { programmeId } = await params;

  const programme = await prisma.programmeTemplate.findUnique({
    where: { id: programmeId },
  });
  if (!programme) notFound();

  // sections is stored as Json; coerce into the expected shape.
  const raw = (programme.sections as unknown) ?? [];
  const sections: Section[] = Array.isArray(raw)
    ? raw.map((s) => {
        const e = (s || {}) as { title?: unknown; items?: unknown };
        return {
          title: typeof e.title === "string" ? e.title : "",
          items: Array.isArray(e.items)
            ? e.items.filter((x): x is string => typeof x === "string")
            : [],
        };
      })
    : [];

  return (
    <ProgrammeForm
      programmeId={programme.id}
      initial={{
        title: programme.title,
        description: programme.description,
        sections,
      }}
    />
  );
}

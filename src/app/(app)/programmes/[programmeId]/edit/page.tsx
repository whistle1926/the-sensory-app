import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProgrammeForm } from "@/components/programmes/programme-form";
import { sanitiseProgrammeSections } from "@/lib/programme-sections";

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

  // sections is stored as Json; sanitise handles both legacy strings and the
  // newer item-object shape, so the form always gets a canonical payload.
  const sections = sanitiseProgrammeSections(programme.sections);

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

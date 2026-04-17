import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sanitiseFormFields, sanitiseFormSettings } from "@/lib/forms";
import { FormBuilder } from "@/components/forms/form-builder";

export default async function EditFormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  const form = await prisma.form.findUnique({
    where: { id: formId },
  });
  if (!form) notFound();

  return (
    <FormBuilder
      formId={form.id}
      initial={{
        id: form.id,
        title: form.title,
        description: form.description ?? "",
        slug: form.slug,
        isPublished: form.isPublished,
        fields: sanitiseFormFields(form.fields),
        settings: sanitiseFormSettings(form.settings),
      }}
    />
  );
}

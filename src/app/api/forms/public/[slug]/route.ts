import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitiseFormFields, sanitiseFormSettings } from "@/lib/forms";

/**
 * Public read of a form by slug. Returns only what the fill page needs —
 * we strip the admin-only settings (notify emails, auto-reply config) so
 * we don't leak internal configuration.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const form = await prisma.form.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      fields: true,
      settings: true,
      isPublished: true,
    },
  });
  if (!form || !form.isPublished) {
    return NextResponse.json(
      { error: "This form is no longer accepting responses." },
      { status: 404 },
    );
  }

  const settings = sanitiseFormSettings(form.settings);
  // Public response only exposes the button text + success message.
  const publicSettings = {
    submitButtonText: settings.submitButtonText ?? "Submit",
    successMessage:
      settings.successMessage ?? "Thanks — we've got your response.",
  };

  return NextResponse.json({
    id: form.id,
    title: form.title,
    slug: form.slug,
    description: form.description,
    fields: sanitiseFormFields(form.fields),
    settings: publicSettings,
  });
}

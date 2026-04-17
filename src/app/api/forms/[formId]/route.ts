import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitiseFormFields, sanitiseFormSettings } from "@/lib/forms";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!isStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { formId } = await params;
  const form = await prisma.form.findUnique({
    where: { id: formId },
    include: {
      _count: { select: { submissions: true, invites: true } },
    },
  });
  if (!form)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(form);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!isStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { formId } = await params;
  const body = await req.json().catch(() => ({}));

  const data: Record<string, unknown> = {};
  if (typeof body?.title === "string") {
    const title = body.title.trim().slice(0, 120);
    if (!title)
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 },
      );
    data.title = title;
  }
  if (typeof body?.description === "string")
    data.description = body.description.trim().slice(0, 2000);
  if (body?.fields !== undefined)
    data.fields = sanitiseFormFields(body.fields) as unknown as object;
  if (body?.settings !== undefined)
    data.settings = sanitiseFormSettings(body.settings) as unknown as object;
  if (typeof body?.isPublished === "boolean")
    data.isPublished = body.isPublished;

  const updated = await prisma.form.update({
    where: { id: formId },
    data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!isStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { formId } = await params;
  // Cascade deletes submissions and invites (configured at the schema level).
  await prisma.form.delete({ where: { id: formId } });
  return NextResponse.json({ ok: true });
}

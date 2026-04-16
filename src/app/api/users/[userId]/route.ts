import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** PATCH — update a user's dashboard template assignment. SUPER_ADMIN only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Record<string, unknown> = {};

  if ("dashTemplateId" in body) {
    if (body.dashTemplateId !== null && typeof body.dashTemplateId !== "string") {
      return NextResponse.json(
        { error: "dashTemplateId must be a string or null" },
        { status: 400 }
      );
    }

    // Verify the template exists if a non-null value is provided.
    if (body.dashTemplateId !== null) {
      const template = await prisma.dashTemplate.findUnique({
        where: { id: body.dashTemplateId },
      });
      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
    }

    data.dashTemplateId = body.dashTemplateId;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, name: true, role: true, dashTemplateId: true },
  });

  return NextResponse.json(user);
}

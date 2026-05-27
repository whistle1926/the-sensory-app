import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessClient } from "@/lib/auth-guard";
import { clientSchema } from "@/lib/validators";
import { ensureParentAccount } from "@/lib/parent-account";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { clientId } = await params;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { sessions: { include: { report: true }, orderBy: { sessionDate: "desc" } } },
  });

  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessClient(session.user.role, session.user.id, client)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(client);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { clientId } = await params;

  // Cross-tenant guard — without this any TEAM_MANAGER could
  // mutate any other manager's client (including reassigning the
  // parent email, which then creates / links a CLIENT account and
  // grants that parent portal access). Load first, check, then update.
  const existing = await prisma.client.findUnique({
    where: { id: clientId },
    select: { managerId: true, parentId: true },
  });
  if (!existing) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!canAccessClient(session.user.role, session.user.id, existing)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = clientSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.dateOfBirth) {
    updateData.dateOfBirth = new Date(parsed.data.dateOfBirth);
  }

  // Accept stageId directly (not in clientSchema).
  if ("stageId" in body) {
    updateData.stageId = body.stageId === null ? null : body.stageId;
  }

  // If parent email changed, relink the parent User account
  let parentAccountCreated = false;
  if (typeof parsed.data.parentCarerEmail === "string") {
    const parentEmail = parsed.data.parentCarerEmail.trim();
    if (parentEmail) {
      try {
        const result = await ensureParentAccount({
          email: parentEmail,
          name: parsed.data.parentCarerName || parentEmail,
          origin: req.nextUrl.origin,
        });
        updateData.parentId = result.userId;
        parentAccountCreated = result.created;
      } catch (err) {
        console.error("Parent account linking failed:", err);
      }
    } else {
      // Empty email = unlink
      updateData.parentId = null;
    }
  }

  const client = await prisma.client.update({
    where: { id: clientId },
    data: updateData,
  });

  return NextResponse.json({ ...client, parentAccountCreated });
}

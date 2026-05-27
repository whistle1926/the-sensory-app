import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessClient } from "@/lib/auth-guard";
import { recordAudit } from "@/lib/audit";
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

/**
 * GDPR Article 17 (right to erasure) — hard delete of a client and
 * everything tied to that child. SUPER_ADMIN only because it's
 * destructive AND because under GDPR the decision to erase is the
 * controller's responsibility, not a managing therapist's.
 *
 * What gets removed (all in a transaction):
 *   - TherapySession rows (RESTRICTed by Report → delete reports first)
 *   - Report rows
 *   - ProgressNote / ClientGoal / ClientIntakeItem (cascade via FK)
 *
 * What stays (deliberately):
 *   - Invoice rows — SetNull on clientId. Accounting / tax records
 *     keep their clientName snapshot; the link to the deleted child
 *     is severed. Required for HMRC retention, not personal-data
 *     identifying the child.
 *   - FormInvite rows — SetNull. Submission audit survives without
 *     the client linkage.
 *   - Parent User account — only this child's link goes away. If
 *     the parent has other children in care they keep portal access.
 *
 * Every deletion is recorded in audit_logs so a regulator can see
 * who erased what when.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Only the practice owner can erase a client record." },
      { status: 403 },
    );
  }

  const { clientId } = await params;

  // Load with counts so the audit row records the scale of the
  // erasure. Done before the transaction so we don't burden the
  // critical section with extra queries.
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      _count: {
        select: {
          sessions: true,
          reports: true,
          progressNotes: true,
          goals: true,
          intakeItems: true,
          invoices: true,
          formInvites: true,
        },
      },
    },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      // Order matters: Report references TherapySession (RESTRICT),
      // so reports must go before sessions. ProgressNote, ClientGoal,
      // ClientIntakeItem cascade automatically. Invoice + FormInvite
      // SetNull.
      await tx.report.deleteMany({ where: { clientId } });
      await tx.therapySession.deleteMany({ where: { clientId } });
      await tx.client.delete({ where: { id: clientId } });
    });
  } catch (err) {
    console.error("[clients/DELETE] erasure failed:", err);
    return NextResponse.json(
      {
        error:
          "Erasure failed — likely a record we don't yet cascade. Contact support.",
      },
      { status: 500 },
    );
  }

  await recordAudit({
    actorId: session.user.id,
    actorLabel: `${session.user.name ?? "?"} <${session.user.email ?? "?"}>`,
    action: "client.delete",
    targetType: "client",
    targetId: clientId,
    meta: {
      clientName: `${client.firstName} ${client.lastName}`,
      recordCounts: client._count,
      reason: "gdpr_erasure",
    },
    req,
  });

  return NextResponse.json({ ok: true });
}

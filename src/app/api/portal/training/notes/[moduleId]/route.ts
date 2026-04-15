import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { moduleId } = await params;

  // Confirm the learner is enrolled in the course that owns this module.
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { id: true, courseId: true },
  });
  if (!mod) return NextResponse.json({ error: "Module not found" }, { status: 404 });

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: mod.courseId } },
    select: { id: true },
  });
  if (!enrollment) return NextResponse.json({ error: "Not enrolled" }, { status: 403 });

  const note = await prisma.learnerNote.findUnique({
    where: { userId_moduleId: { userId: session.user.id, moduleId } },
    select: { body: true, updatedAt: true },
  });

  return NextResponse.json({
    body: note?.body ?? "",
    updatedAt: note?.updatedAt ?? null,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { moduleId } = await params;
  const payload = await req.json().catch(() => null);
  const body = typeof payload?.body === "string" ? payload.body : null;
  if (body === null) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  if (body.length > 20_000) {
    return NextResponse.json({ error: "Note too long" }, { status: 400 });
  }

  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { id: true, courseId: true },
  });
  if (!mod) return NextResponse.json({ error: "Module not found" }, { status: 404 });

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: mod.courseId } },
    select: { id: true },
  });
  if (!enrollment) return NextResponse.json({ error: "Not enrolled" }, { status: 403 });

  const note = await prisma.learnerNote.upsert({
    where: { userId_moduleId: { userId: session.user.id, moduleId } },
    create: { userId: session.user.id, moduleId, body },
    update: { body },
    select: { body: true, updatedAt: true },
  });

  return NextResponse.json({ body: note.body, updatedAt: note.updatedAt });
}

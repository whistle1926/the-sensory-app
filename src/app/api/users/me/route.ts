/** The signed-in user's own profile — name, bio and photo. Used by the course
 *  editor's "Use my details" so a bio is written once, not per course. */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, bio: true, photoUrl: true, phone: true },
  });
  if (!me) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(me);
}

/**
 * Save your own instructor details — bio and photo.
 *
 * Written from the course editor's "Save these as my details", so a bio typed
 * once on a course becomes the default for every course afterwards. Own
 * profile only; changing someone else's is a Team action.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (typeof body.bio === "string") data.bio = body.bio.trim().slice(0, 5_000) || null;
  if (typeof body.photoUrl === "string")
    data.photoUrl = body.photoUrl.trim().slice(0, 1_000) || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  const me = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { name: true, bio: true, photoUrl: true },
  });
  return NextResponse.json(me);
}

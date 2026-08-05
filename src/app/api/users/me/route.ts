/** The signed-in user's own profile — name, bio and photo. Used by the course
 *  editor's "Use my details" so a bio is written once, not per course. */
import { NextResponse } from "next/server";
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

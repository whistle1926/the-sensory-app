import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitiseFormFields, sanitiseFormSettings } from "@/lib/forms";
import { makeSlug } from "@/lib/slug";

function isStaff(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "TEAM_MANAGER";
}

// GET — list forms visible to the current staff user. We include a submission
// count so the list page can show "3 responses" without fetching them all.
export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!isStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.form.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      isPublished: true,
      settings: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true } },
      _count: { select: { submissions: true, invites: true } },
    },
  });
  return NextResponse.json(rows);
}

// POST — create a form. Accepts optional initial fields/settings; builder will
// immediately PATCH with the real content.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!isStaff(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const title =
    typeof body?.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 120)
      : "Untitled form";

  const fields = sanitiseFormFields(body?.fields);
  const settings = sanitiseFormSettings(body?.settings);

  // Retry on slug collisions — rare but possible with random suffixes.
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = makeSlug(title);
    try {
      const created = await prisma.form.create({
        data: {
          title,
          slug,
          description:
            typeof body?.description === "string"
              ? body.description.trim().slice(0, 2000)
              : null,
          fields: fields as unknown as object,
          settings: settings as unknown as object,
          createdById: session.user.id,
        },
      });
      return NextResponse.json(created, { status: 201 });
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
      ) {
        // unique constraint (slug) — try a new suffix
        continue;
      }
      throw err;
    }
  }

  return NextResponse.json(
    { error: "Couldn't generate a unique URL. Try a different title." },
    { status: 500 },
  );
}

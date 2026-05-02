import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTermsConfig, saveTermsConfig } from "@/lib/booking-terms-store";

/** GET — public. Used by the /book client form to render the tick boxes. */
export async function GET() {
  const cfg = await getTermsConfig();
  return NextResponse.json(cfg);
}

/** PUT — staff only. Replaces the clause set + bumps the version. */
export async function PUT(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "TEAM_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const cfg = await saveTermsConfig({
    version:
      typeof body.version === "string"
        ? body.version
        : new Date().toISOString().slice(0, 10),
    clauses: Array.isArray(body.clauses) ? body.clauses : [],
  });
  return NextResponse.json(cfg);
}

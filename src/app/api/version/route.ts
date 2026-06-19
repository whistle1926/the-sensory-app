import { NextResponse } from "next/server";

// Always reflect the live deployment — never cache, never prerender.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Returns the currently-deployed build id. Vercel injects the commit
// SHA (and a per-deployment id) into the function's runtime env, so
// this endpoint always reports the LATEST production deployment — even
// when an older browser tab (carrying an older baked-in build id) is
// the one asking. The client compares the two to detect a new release.
export function GET() {
  // NEXT_PUBLIC_BUILD_ID is inlined at build time (see next.config.ts)
  // into BOTH the client bundle and this route, so each deployment
  // reports its own build id without depending on runtime env vars.
  const version =
    process.env.NEXT_PUBLIC_BUILD_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    "dev";
  return NextResponse.json(
    { version },
    {
      headers: {
        // Defend against any intermediary caching a stale version.
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}

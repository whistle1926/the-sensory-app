import type { NextConfig } from "next";

// Build identifier baked into the client bundle. On Vercel this is the
// git commit SHA of the deployment; locally it falls back to "dev".
// The /api/version route reads the SAME source at runtime, so once a
// new deployment goes live the value it returns differs from the SHA
// baked into already-loaded browser tabs — that's what drives the
// "update available" banner.
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  "dev";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
};

export default nextConfig;

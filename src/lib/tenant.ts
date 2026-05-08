/**
 * Tenant resolution — Phase 1a stub.
 *
 * In the final architecture (see white-label plan), middleware extracts
 * the subdomain from the Host header, looks up the matching `Tenant`
 * row, and stamps `x-tenant-id` onto the request. Server Components,
 * route handlers and Server Actions then call `getCurrentTenant()` to
 * read it back.
 *
 * Today we're at Phase 1a: the Tenant table exists and is seeded with
 * "platform" + "submarine", but no model carries `tenantId` yet and no
 * middleware writes the header. So this helper falls back to the
 * "submarine" tenant unconditionally — keeps the existing app working
 * while we wire the rest of the pipeline up incrementally.
 *
 * Once Phase 1b ships (middleware + Prisma row-filter extension), the
 * fallback path goes away and this becomes a strict read of the request
 * header.
 */
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Tenant } from "@prisma/client";

const FALLBACK_SUBDOMAIN = "submarine";
const PLATFORM_SUBDOMAIN = "platform";

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "platform",
  "auth",
  "static",
  "assets",
  "mail",
  "email",
]);

/**
 * Read the resolved tenant for the current request. Throws if the tenant
 * can't be resolved at all (mid-migration, this means the seed didn't
 * run — recover by `npx tsx ./seed-tenants.ts`).
 */
export async function getCurrentTenant(): Promise<Tenant> {
  // Phase 1b will populate this via middleware:
  //   const id = headers().get("x-tenant-id");
  // For now we ignore the header and look up by subdomain fallback.
  let id: string | null = null;
  try {
    const h = await headers();
    id = h.get("x-tenant-id");
  } catch {
    // headers() is only available in request scopes — falls through to
    // the subdomain fallback below for build-time / non-request callers.
  }

  if (id) {
    const byId = await prisma.tenant.findUnique({ where: { id } });
    if (byId) return byId;
  }

  const byFallback = await prisma.tenant.findUnique({
    where: { subdomain: FALLBACK_SUBDOMAIN },
  });
  if (!byFallback) {
    throw new Error(
      `Tenant '${FALLBACK_SUBDOMAIN}' missing. Run \`node _run-with-env.js npx tsx ./seed-tenants.ts\`.`,
    );
  }
  return byFallback;
}

/**
 * Variant for routes mounted at the apex (`aiworldexperts.com/courses`,
 * `aiworldexperts.com/platform/...`) where the platform tenant is the
 * implicit owner. Returns the platform tenant when no specific tenant
 * is in context.
 */
export async function getCurrentTenantOrPlatform(): Promise<Tenant> {
  try {
    return await getCurrentTenant();
  } catch {
    const platform = await prisma.tenant.findUnique({
      where: { subdomain: PLATFORM_SUBDOMAIN },
    });
    if (!platform) {
      throw new Error(
        `Tenant '${PLATFORM_SUBDOMAIN}' missing. Run the tenants seed.`,
      );
    }
    return platform;
  }
}

/**
 * Pull the subdomain out of a Host header. Handles:
 *  • `sarah.aiworldexperts.com` → "sarah"
 *  • `aiworldexperts.com`        → null (apex)
 *  • `localhost:3000`            → null
 *  • `127.0.0.1:3000`            → null
 *  • IPv4/IPv6 literals          → null
 *
 * Reserved subdomains return null too so they never resolve to a tenant.
 */
export function extractSubdomain(host: string): string | null {
  if (!host) return null;
  // Strip port.
  const bare = host.split(":")[0];
  // IPv4 — all numeric segments.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(bare)) return null;
  // localhost or single-label hosts.
  const parts = bare.split(".");
  if (parts.length < 3) return null;
  // Apex like `aiworldexperts.com` has length 2; treat it as null. Sub-
  // domains like `sarah.aiworldexperts.com` have length 3+.
  const sub = parts[0]?.toLowerCase();
  if (!sub || RESERVED_SUBDOMAINS.has(sub)) return null;
  return sub;
}

/** Validate a subdomain at signup time. */
export function validateSubdomain(input: string): string | null {
  const s = input.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/.test(s)) {
    return "Subdomain must be 2–32 chars, letters/numbers/hyphens, no leading/trailing hyphen.";
  }
  if (RESERVED_SUBDOMAINS.has(s)) {
    return "That subdomain is reserved.";
  }
  return null;
}

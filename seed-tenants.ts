/**
 * One-off seed for the multi-tenant foundation. Idempotent — re-running
 * upserts on stable keys.
 *
 * Creates:
 *  • TenantPlan rows: starter, pro, premium, platform
 *  • Tenant rows: "platform" (Patrick's cross-tenant admin home) and
 *    "submarine" (the existing OT practice — current production data
 *    will get backfilled to this tenant in Phase 1c of the white-label
 *    plan).
 *
 * Usage:
 *   node _run-with-env.js npx tsx ./seed-tenants.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface PlanSeed {
  key: string;
  label: string;
  pricePence: number;
  setupFeePence: number;
  enabledFeatures: string[];
  maxClients: number | null;
  maxStaff: number | null;
  maxStorageMb: number | null;
  isPublic: boolean;
}

const PLANS: PlanSeed[] = [
  {
    key: "starter",
    label: "Starter",
    pricePence: 4900, // £49/mo
    setupFeePence: 0,
    enabledFeatures: [
      "clients",
      "reports",
      "bookings",
      "programmes",
      "tasks",
      "leaflets",
      "forms",
    ],
    maxClients: 25,
    maxStaff: 1,
    maxStorageMb: 1024,
    isPublic: true,
  },
  {
    key: "pro",
    label: "Pro",
    pricePence: 9900, // £99/mo
    setupFeePence: 0,
    enabledFeatures: [
      "clients",
      "reports",
      "bookings",
      "programmes",
      "tasks",
      "leaflets",
      "forms",
      "courses_storefront",
      "live_sessions",
      "ai_report_writer",
    ],
    maxClients: 100,
    maxStaff: 3,
    maxStorageMb: 10240,
    isPublic: true,
  },
  {
    key: "premium",
    label: "Premium",
    pricePence: 19900, // £199/mo
    setupFeePence: 0,
    enabledFeatures: [
      "clients",
      "reports",
      "bookings",
      "programmes",
      "tasks",
      "leaflets",
      "forms",
      "courses_storefront",
      "live_sessions",
      "ai_report_writer",
      "schools_dashboard",
      "white_label_email",
      "custom_domain",
    ],
    maxClients: null,
    maxStaff: null,
    maxStorageMb: 102400,
    isPublic: true,
  },
  {
    key: "platform",
    label: "Platform Owner",
    pricePence: 0,
    setupFeePence: 0,
    enabledFeatures: ["*"], // sentinel — bypass-flag in feature resolver
    maxClients: null,
    maxStaff: null,
    maxStorageMb: null,
    isPublic: false, // never offered for purchase
  },
];

async function main() {
  // ── Plans ────────────────────────────────────────────────────────────
  for (const p of PLANS) {
    await prisma.tenantPlan.upsert({
      where: { key: p.key },
      update: p,
      create: p,
    });
  }
  console.log(`✓ ${PLANS.length} TenantPlan rows ready`);

  // ── Platform tenant ──────────────────────────────────────────────────
  // Patrick's cross-tenant admin home. Subdomain "platform" is reserved.
  await prisma.tenant.upsert({
    where: { subdomain: "platform" },
    update: {},
    create: {
      subdomain: "platform",
      displayName: "Platform Admin",
      planKey: "platform",
      status: "active",
      theme: {
        displayName: "Platform Admin",
        footerTagline: "Cross-tenant administration",
      },
    },
  });
  console.log("✓ Tenant 'platform' ready");

  // ── Submarine tenant ─────────────────────────────────────────────────
  // The existing OT practice. All current production data will be
  // backfilled to this tenant in the upcoming Phase 1c migration.
  await prisma.tenant.upsert({
    where: { subdomain: "submarine" },
    update: {},
    create: {
      subdomain: "submarine",
      displayName: "The Sensory Submarine",
      planKey: "premium", // Patrick's own practice gets the full feature set
      status: "active",
      theme: {
        displayName: "The Sensory Submarine",
        footerTagline: "OT Report Platform",
        primaryColor: "oklch(0.50 0.24 264)",
        sidebarColor: "oklch(0.17 0.015 280)",
        supportEmail: "patrick@thesensorysubmarine.com",
      },
    },
  });
  console.log("✓ Tenant 'submarine' ready");

  console.log("\nNext: Phase 1c — add tenantId to existing models + backfill.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

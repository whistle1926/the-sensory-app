import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("sensory2026", 12);

  await prisma.user.upsert({
    where: { email: "patrick@thesensorysubmarine.com" },
    update: {},
    create: {
      email: "patrick@thesensorysubmarine.com",
      name: "Patrick Farren",
      passwordHash,
      role: "SUPER_ADMIN",
      business: "SENSORY_SUBMARINE",
    },
  });

  console.log("Seed complete: Super Admin created (patrick@thesensorysubmarine.com / sensory2026)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

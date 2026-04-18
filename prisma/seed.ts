import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("sensory2026", 12);

  await prisma.user.upsert({
    where: { email: "patrick@thesensorysubmarine.com" },
    update: {},
    create: {
      email: "patrick@thesensorysubmarine.com",
      name: "Grace Magennis",
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

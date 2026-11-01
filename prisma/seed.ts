import { prisma } from "../lib/db/client";
import { hashPassword } from "../lib/auth/password";
import { ensureWorkspaceForUser } from "../lib/workspace";


async function main() {
  console.log("Seeding default Super Admin user...");

  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [{ username: "admin" }, { systemRole: "SUPER_ADMIN" }],
    },
  });

  if (existingAdmin) {
    console.log(`Admin user already exists: username="${existingAdmin.username || "admin"}"`);
    return;
  }

  const passwordHash = hashPassword("admin123456");

  const adminUser = await prisma.user.create({
    data: {
      username: "admin",
      name: "مدیر ارشد سیستم",
      passwordHash,
      systemRole: "SUPER_ADMIN",
    },
  });

  await ensureWorkspaceForUser(adminUser.id, "admin");

  console.log("✓ Super Admin user created successfully!");
  console.log("-----------------------------------------");
  console.log("Username: admin");
  console.log("Password: admin123456");
  console.log("-----------------------------------------");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

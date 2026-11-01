import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "../lib/db/client";

export async function baselineMigrations(dryRun = false) {
  console.log("==================================================");
  console.log("  🛡️  OPENREPLY MARIADB BASELINE MANAGER          ");
  console.log("==================================================");

  // 1. Check if database is reachable
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
  } catch (err: any) {
    console.error("❌ Cannot connect to database:", err.message);
    return { success: false, error: err.message };
  }

  // 2. Ensure _prisma_migrations table exists
  const createMigrationsTableSql = `
    CREATE TABLE IF NOT EXISTS \`_prisma_migrations\` (
      \`id\` VARCHAR(36) NOT NULL,
      \`checksum\` VARCHAR(64) NOT NULL,
      \`finished_at\` DATETIME(3) NULL,
      \`migration_name\` VARCHAR(255) NOT NULL,
      \`logs\` TEXT NULL,
      \`rolled_back_at\` DATETIME(3) NULL,
      \`started_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`applied_steps_count\` INT UNSIGNED NOT NULL DEFAULT 1,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `;

  if (!dryRun) {
    await prisma.$queryRawUnsafe(createMigrationsTableSql);
  }

  // 3. Read existing migrations from database
  let existingNames: string[] = [];
  try {
    const existing = await prisma.$queryRawUnsafe<any[]>(
      "SELECT migration_name FROM `_prisma_migrations` WHERE rolled_back_at IS NULL"
    );
    existingNames = existing.map((r) => r.migration_name);
  } catch (e) {
    // If table doesn't exist in dryRun
  }

  // 4. Scan prisma/migrations directory
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    console.log("⚠️ No prisma/migrations directory found.");
    return { success: true, baselined: 0 };
  }

  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
  const migrationFolders = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  console.log(`Found ${migrationFolders.length} migrations in repository.`);
  console.log(`Found ${existingNames.length} migrations recorded in database.`);

  let newlyBaselined = 0;

  for (const name of migrationFolders) {
    if (existingNames.includes(name)) {
      continue;
    }

    const sqlPath = path.join(migrationsDir, name, "migration.sql");
    let checksum = "";
    if (fs.existsSync(sqlPath)) {
      const content = fs.readFileSync(sqlPath, "utf-8");
      checksum = crypto.createHash("sha256").update(content).digest("hex");
    } else {
      checksum = crypto.createHash("sha256").update(name).digest("hex");
    }

    const id = crypto.randomUUID();
    console.log(`  ➔ Baselining: ${name} (Checksum: ${checksum.slice(0, 12)}...)`);

    if (!dryRun) {
      await prisma.$executeRawUnsafe(
        "INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES (?, ?, NOW(3), ?, NULL, NULL, NOW(3), 1)",
        id,
        checksum,
        name
      );
    }
    newlyBaselined++;
  }

  console.log("--------------------------------------------------");
  if (newlyBaselined > 0) {
    console.log(`✅ Successfully baselined ${newlyBaselined} migrations!`);
    console.log("   Prisma Migrate is now safe to run without PostgreSQL syntax errors.");
  } else {
    console.log("✅ All migrations are already baselined and synchronized.");
  }
  console.log("==================================================");

  return { success: true, newlyBaselined, total: migrationFolders.length };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run") || process.argv.includes("--check");
  try {
    await baselineMigrations(dryRun);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith("db-baseline.ts")) {
  main().catch((err) => {
    console.error("❌ Baseline failed:", err);
    process.exit(1);
  });
}

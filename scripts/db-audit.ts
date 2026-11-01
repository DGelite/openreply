import { prisma } from "../lib/db/client";

interface TableInfo {
  name: string;
  rowCount: number;
}

export async function auditDatabase(): Promise<{
  connected: boolean;
  serverVersion?: string;
  tableCount: number;
  tables: string[];
  prismaMigrationsTableExists: boolean;
  appliedMigrations: string[];
  missingCriticalTables: string[];
  error?: string;
}> {
  try {
    // 1. Connection check & server version
    const versionRes = await prisma.$queryRawUnsafe<any[]>("SELECT VERSION() as version");
    const serverVersion = versionRes?.[0]?.version || "Unknown";

    // 2. Fetch all tables in database
    const tablesRaw = await prisma.$queryRawUnsafe<any[]>("SHOW TABLES");
    const tables: string[] = tablesRaw.map((row) => Object.values(row)[0] as string);

    // 3. Check for _prisma_migrations
    const prismaMigrationsTableExists = tables.some(
      (t) => t.toLowerCase() === "_prisma_migrations"
    );

    let appliedMigrations: string[] = [];
    if (prismaMigrationsTableExists) {
      const migsRaw = await prisma.$queryRawUnsafe<any[]>(
        "SELECT migration_name FROM `_prisma_migrations` WHERE rolled_back_at IS NULL ORDER BY started_at ASC"
      );
      appliedMigrations = migsRaw.map((m) => m.migration_name);
    }

    // 4. Critical table check
    const criticalExpected = [
      "User",
      "Workspace",
      "InstagramAccount",
      "Automation",
      "DmLog",
      "BackgroundJob",
      "Lead",
      "OperationalEvent",
    ];
    const missingCriticalTables = criticalExpected.filter(
      (expected) => !tables.some((t) => t.toLowerCase() === expected.toLowerCase())
    );

    return {
      connected: true,
      serverVersion,
      tableCount: tables.length,
      tables,
      prismaMigrationsTableExists,
      appliedMigrations,
      missingCriticalTables,
    };
  } catch (err: any) {
    return {
      connected: false,
      tableCount: 0,
      tables: [],
      prismaMigrationsTableExists: false,
      appliedMigrations: [],
      missingCriticalTables: [],
      error: err.message,
    };
  }
}

async function main() {
  console.log("==================================================");
  console.log("  🔍 OPENREPLY MARIADB DATABASE AUDITOR          ");
  console.log("==================================================");

  const audit = await auditDatabase();

  if (!audit.connected) {
    console.error("❌ Database Connection Failed:", audit.error);
    process.exit(1);
  }

  console.log(`✅ Connected to Database!`);
  console.log(`   Engine Version: ${audit.serverVersion}`);
  console.log(`   Total Tables:   ${audit.tableCount}`);
  console.log(`   _prisma_migrations: ${audit.prismaMigrationsTableExists ? "FOUND" : "NOT FOUND (Unmanaged / Direct SQL)"}`);

  if (audit.prismaMigrationsTableExists) {
    console.log(`   Applied Migrations: ${audit.appliedMigrations.length}`);
    audit.appliedMigrations.forEach((m) => console.log(`     - ${m}`));
  } else {
    console.log("   ⚠️ Note: Baseline needed before running 'prisma migrate deploy' to avoid PostgreSQL syntax errors.");
  }

  if (audit.missingCriticalTables.length > 0) {
    console.warn(`⚠️ Missing Critical Tables: ${audit.missingCriticalTables.join(", ")}`);
  } else {
    console.log("✅ All critical OpenReply tables are present!");
  }

  console.log("==================================================");
  await prisma.$disconnect();
}

if (process.argv[1]?.endsWith("db-audit.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

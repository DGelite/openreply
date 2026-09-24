import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// Read .env file manually
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

// Run Prisma migrate
console.log("Running Prisma Migrate with DATABASE_URL from .env...");
try {
  execSync("npx prisma migrate dev --name add_collect_phone_skip_otp", {
    stdio: "inherit",
    env: { ...process.env },
  });
  console.log("✅ Migration successful!");
} catch (error) {
  console.error("❌ Migration failed.");
  process.exit(1);
}

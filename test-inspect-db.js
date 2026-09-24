require('dotenv').config();
const { PrismaClient } = require('./lib/generated/prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

async function inspectDb() {
  let dbUrl = process.env.DATABASE_URL || 'mysql://digitale_digitaleliteisntal:%2B-3H3oI~qhQAv%26p7@127.0.0.1:3306/digitale_digitaleliteisntal';
  dbUrl = dbUrl.replace('@localhost', '@127.0.0.1');
  if (!dbUrl.includes('allowPublicKeyRetrieval=')) {
    dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'allowPublicKeyRetrieval=true';
  }

  const adapter = new PrismaMariaDb(dbUrl, { useTextProtocol: true });
  const prisma = new PrismaClient({ adapter });

  try {
    const workspaces = await prisma.workspace.findMany();
    console.log("=== WORKSPACES IN DB ===");
    console.log(workspaces);

    const aiConfigs = await prisma.aiConfig.findMany();
    console.log("=== AI CONFIGS IN DB ===");
    console.log(aiConfigs);
  } catch (e) {
    console.error("DB Error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

inspectDb();

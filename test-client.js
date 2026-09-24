require('dotenv').config();
const { PrismaClient } = require('./lib/generated/prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

async function test() {
  let dbUrl = process.env.DATABASE_URL || 'mysql://digitale_digitaleliteisntal:%2B-3H3oI~qhQAv%26p7@127.0.0.1:3306/digitale_digitaleliteisntal';
  
  // Replace localhost with 127.0.0.1 to prevent Node 22 IPv6 resolution delays
  dbUrl = dbUrl.replace('@localhost', '@127.0.0.1');

  // Ensure allowPublicKeyRetrieval=true is present without corrupting % URL-encoded password characters
  if (!dbUrl.includes('allowPublicKeyRetrieval=')) {
    dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'allowPublicKeyRetrieval=true';
  }

  console.log("Processed DB URL:", dbUrl);

  const adapter = new PrismaMariaDb(dbUrl, { useTextProtocol: true });
  const prisma = new PrismaClient({ adapter });

  try {
    const u = await prisma.user.findFirst();
    console.log("🎉 SUCCESS! User found:", u ? u.username : "No user");
  } catch (e) {
    console.error("❌ ERROR:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();

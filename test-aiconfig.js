require('dotenv').config();
const { PrismaClient } = require('./lib/generated/prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

async function testAiConfig() {
  let dbUrl = process.env.DATABASE_URL || 'mysql://digitale_digitaleliteisntal:%2B-3H3oI~qhQAv%26p7@127.0.0.1:3306/digitale_digitaleliteisntal';
  dbUrl = dbUrl.replace('@localhost', '@127.0.0.1');
  if (!dbUrl.includes('allowPublicKeyRetrieval=')) {
    dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'allowPublicKeyRetrieval=true';
  }

  const adapter = new PrismaMariaDb(dbUrl, { useTextProtocol: true });
  const prisma = new PrismaClient({ adapter });

  try {
    const ws = await prisma.workspace.findFirst();
    console.log("Workspace found:", ws ? ws.id : "NO WORKSPACE");

    if (ws) {
      const saved = await prisma.aiConfig.upsert({
        where: { workspaceId: ws.id },
        create: {
          workspaceId: ws.id,
          isEnabled: true,
          provider: "GEMINI",
          model: "gemini-2.5-flash-lite",
          brandVoice: "تست لحن برند رسمی",
          systemPrompt: "دستورالعمل تست هوش مصنوعی",
        },
        update: {
          isEnabled: true,
          provider: "GEMINI",
          model: "gemini-2.5-flash-lite",
          brandVoice: "تست لحن برند رسمی",
          systemPrompt: "دستورالعمل تست هوش مصنوعی",
        },
      });
      console.log("🎉 SUCCESS! Saved to DB:", saved);
    }
  } catch (e) {
    console.error("❌ ERROR saving to DB:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAiConfig();

import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    try {
      require('dotenv').config({ path: process.cwd() + '/.env' });
    } catch (e) {}
  }

  let dbUrl = process.env.DATABASE_URL || 'mysql://root:pass@127.0.0.1:3306/db';
  
  // Replace localhost with 127.0.0.1 to prevent Node 22 IPv6 resolution delays
  dbUrl = dbUrl.replace('@localhost', '@127.0.0.1');

  // Ensure allowPublicKeyRetrieval=true is present without corrupting % URL-encoded password characters
  if (!dbUrl.includes('allowPublicKeyRetrieval=')) {
    dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'allowPublicKeyRetrieval=true';
  }

  // Enforce connection pool limit per process to respect VPS connection budget (e.g. 5 per instance)
  const connectionLimit = process.env.DB_CONNECTION_LIMIT || '5';
  if (!dbUrl.includes('connectionLimit=')) {
    dbUrl += (dbUrl.includes('?') ? '&' : '?') + `connectionLimit=${connectionLimit}`;
  }

  // PrismaMariaDb handles createPool internally when given a string URL or config object
  const adapter = new PrismaMariaDb(dbUrl, { useTextProtocol: true });
  return new PrismaClient({ adapter });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

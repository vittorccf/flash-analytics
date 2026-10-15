import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 conversa com o Postgres pelo driver "pg" (adapter), sem engine nativo. A URL é lida no primeiro uso do
// módulo, não no build.
const createClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Uma instância por processo (em dev o hot reload recriaria conexões a cada mudança).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type DbTransaction = Parameters<Parameters<typeof db.$transaction>[0]>[0];

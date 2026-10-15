// Configuração do CLI do Prisma (migrations, seed, generate). No Prisma 7 as URLs saem do schema e ficam aqui.
import { defineConfig } from "prisma/config";

// O Prisma 7 não lê o .env sozinho. loadEnvFile não sobrescreve o que já veio do ambiente (CI, e2e, db:local).
try {
  process.loadEnvFile();
} catch {
  // Sem .env (CI, Vercel, Docker): as variáveis já estão no ambiente.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // Migrations precisam de conexão direta (sem pooler): na Neon, a URL "unpooled".
  datasource: { url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL },
});

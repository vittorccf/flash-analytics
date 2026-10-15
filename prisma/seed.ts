// SEED_DEMO=1 npm run db:seed — dados de demonstração: 2 operadores e contatos (SEED_COUNT, padrão 25) gerados por
// src/lib/demo-data.ts (o mesmo gerador do botão "Dados de teste" em Manutenção).
// Opt-in de propósito: sem SEED_DEMO=1 não faz nada (nunca roda sem querer em produção).
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateTemporaryPassword, hashPassword } from "../src/server/auth/password";
import { generateDemoContacts } from "../src/lib/demo-data";

// O Prisma 7 não lê o .env sozinho (o que já está no ambiente prevalece).
try {
  process.loadEnvFile();
} catch {
  // sem .env: variáveis do ambiente
}

if (process.env.SEED_DEMO !== "1") {
  console.log("Nada a fazer: rode com SEED_DEMO=1 para criar dados de demonstração.");
  process.exit(0);
}

const OPERATORS = [
  { name: "Ana Souza", email: "ana.operadora@exemplo.com" },
  { name: "Bruno Lima", email: "bruno.operador@exemplo.com" },
];

// Quantidade: SEED_COUNT (padrão 25, mais de duas páginas na lista).
const COUNT = Math.min(500, Math.max(1, Number(process.env.SEED_COUNT ?? 25) || 25));

const main = async () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const operators: { id: string }[] = [];
    for (const op of OPERATORS) {
      const password = generateTemporaryPassword();
      const user = await db.user.upsert({
        where: { email: op.email },
        create: { ...op, role: "OPERATOR", passwordHash: await hashPassword(password) },
        update: { passwordHash: await hashPassword(password), status: "ACTIVE", mustChangePassword: false },
      });
      operators.push(user);
      console.log(`Operador ${op.email} — senha: ${password}`);
    }

    await db.contact.deleteMany({ where: { createdById: { in: operators.map((o) => o.id) } } });
    // Semente fixa: rodar o seed de novo gera os mesmos contatos.
    const contacts = generateDemoContacts(COUNT, 42);
    await db.contact.createMany({ data: contacts.map((c, i) => ({ ...c, createdById: operators[i % operators.length]!.id })) });
    console.log(`${COUNT} contatos de demonstração criados.`);
  } finally {
    await db.$disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

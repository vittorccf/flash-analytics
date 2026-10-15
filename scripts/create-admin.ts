// npm run db:admin -- --email admin@empresa.com --name "Nome do Admin"
// Cria (ou promove) um administrador. Não existe usuário/senha padrão no sistema: a senha vem de
// ADMIN_PASSWORD ou é gerada aqui, exibida uma única vez e precisa ser trocada no primeiro acesso.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateTemporaryPassword, hashPassword } from "../src/server/auth/password";
import { passwordProblem } from "../src/lib/password-policy";

// O Prisma 7 não lê o .env sozinho (o que já está no ambiente prevalece).
try {
  process.loadEnvFile();
} catch {
  // sem .env: variáveis do ambiente
}

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const main = async () => {
  const email = (arg("email") ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = (arg("name") ?? process.env.ADMIN_NAME ?? "Administrador").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Uso: npm run db:admin -- --email admin@empresa.com --name "Nome"');
    process.exit(1);
  }

  const provided = process.env.ADMIN_PASSWORD;
  if (provided) {
    const problem = passwordProblem(provided, { email, name });
    if (problem) {
      console.error(`ADMIN_PASSWORD recusada: ${problem}`);
      process.exit(1);
    }
  }
  const password = provided ?? generateTemporaryPassword();
  const passwordHash = await hashPassword(password);
  const mustChangePassword = !provided;

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    await db.user.upsert({
      where: { email },
      create: { email, name, passwordHash, role: "ADMIN", mustChangePassword },
      update: { role: "ADMIN", status: "ACTIVE", passwordHash, mustChangePassword, passwordChangedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
    // Senha nova invalida qualquer sessão anterior desta conta.
    await db.session.deleteMany({ where: { user: { email } } });
    await db.auditLog.create({ data: { action: "user.created", entity: "User", metadata: { via: "cli", email, role: "ADMIN" } } });
  } finally {
    await db.$disconnect();
  }

  console.log(`\nAdministrador pronto: ${email}`);
  if (!provided) console.log(`Senha provisória (exibida só agora; troca obrigatória no primeiro acesso): ${password}\n`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

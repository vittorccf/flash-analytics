// Servidor dos testes ponta a ponta: Postgres embutido e descartável (porta 5434, ou E2E_DATABASE_URL no CI),
// migrations do zero, um admin conhecido e o build de produção na porta 3300.
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { startEmbeddedPostgres } from "./pg-embedded.mjs";

const PORT = 3300;
const DIST = ".next-e2e";
let pg = null;
let url = process.env.E2E_DATABASE_URL;

if (!url) {
  const dir = path.resolve(".pgdata-e2e");
  fs.rmSync(dir, { recursive: true, force: true });
  ({ pg, url } = await startEmbeddedPostgres({ dir, port: 5434, database: "flash_e2e", persistent: false }));
}

const env = {
  ...process.env,
  DATABASE_URL: url,
  DATABASE_URL_UNPOOLED: url,
  NEXT_DIST_DIR: DIST,
  NEXT_TELEMETRY_DISABLED: "1",
  CHECKPOINT_DISABLE: "1",
  ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
  // Testes simulam IPs diferentes por este cabeçalho (como faria o proxy da plataforma).
  TRUSTED_IP_HEADER: "x-forwarded-for",
  // Busca de CEP simulada: os testes não dependem de rede nem das APIs públicas.
  CEP_PROVIDER: "mock",
  // Domínios de teste (e2e.local, exemplo.com) não têm DNS: a checagem de e-mail fica desligada.
  EMAIL_DOMAIN_CHECK: "off",
  // Manutenção (limpar base, dados de teste) liberada no ambiente de teste; o cron fica com um segredo conhecido.
  ALLOW_DATA_RESET: "true",
  CRON_SECRET: "segredo-do-cron-apenas-para-teste",
};

const run = (cmd, extra = {}) => execSync(cmd, { stdio: "inherit", env: { ...env, ...extra } });

run("npx prisma migrate deploy");
run("npx tsx scripts/create-admin.ts --email admin@e2e.local --name \"Admin E2E\"", { ADMIN_PASSWORD: "cavalo correto bateria e2e" });
if (!process.env.E2E_SKIP_BUILD || !fs.existsSync(DIST)) run("npx next build");

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { stdio: "inherit", env: { ...env, NODE_ENV: "production" } });

const stop = async () => {
  server.kill();
  if (pg) await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", async (code) => {
  if (pg) await pg.stop();
  process.exit(code ?? 0);
});

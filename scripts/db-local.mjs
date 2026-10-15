// npm run db:local — sobe um Postgres local em localhost:5433 (dados em .pgdata) e aplica as migrations.
// Na primeira vez, crie o administrador com `npm run db:admin`. Ctrl+C para parar.
import { execSync } from "node:child_process";
import path from "node:path";
import { startEmbeddedPostgres } from "./pg-embedded.mjs";

const { pg, url } = await startEmbeddedPostgres({ dir: path.resolve(".pgdata"), port: 5433, database: "flash" });
if (!process.argv.includes("--no-migrate")) {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
  });
}
console.log(`\nPostgres pronto: ${url}\nCtrl+C para parar.`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);

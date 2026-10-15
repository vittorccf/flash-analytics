// npm run job:limpeza — o mesmo job de limpeza da rota /api/cron/limpeza, para rodar pelo cron do servidor
// (on-premises), ex.: 0 3 * * *  docker compose run --rm migrate npx tsx scripts/cleanup.ts
import { db } from "../src/server/db";
import { runCleanup } from "../src/server/maintenance";

runCleanup("cli")
  .then((removed) => {
    console.log("Limpeza concluída:", removed);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

// Postgres embutido (binários oficiais via npm), para desenvolvimento e testes sem Docker.
import fs from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

export async function startEmbeddedPostgres({ dir, port, database, persistent = true }) {
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: "postgres",
    port,
    persistent,
    onLog: () => {},
  });
  if (!fs.existsSync(path.join(dir, "PG_VERSION"))) await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase(database);
  } catch {
    // banco já existe
  }
  // O initdb herda o fuso da máquina; o Prisma grava em UTC. Banco em UTC, como na Neon e na imagem Docker.
  const client = pg.getPgClient();
  await client.connect();
  await client.query(`ALTER DATABASE "${database}" SET timezone TO 'UTC'`);
  await client.end();
  return { pg, url: `postgresql://postgres:postgres@localhost:${port}/${database}` };
}

// No Windows o Playwright encerra o servidor sem dar chance ao script de parar o Postgres embutido,
// e um processo-filho órfão segura a porta 5434 na próxima execução. Aqui ele é parado de forma limpa.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export default function globalTeardown() {
  if (process.env.E2E_DATABASE_URL) return;
  const dataDir = path.resolve(".pgdata-e2e");
  const bin = path.resolve("node_modules/@embedded-postgres", `${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`, "native/bin/pg_ctl");
  if (!fs.existsSync(dataDir)) return;
  try {
    execFileSync(process.platform === "win32" ? `${bin}.exe` : bin, ["stop", "-D", dataDir, "-m", "fast"], { stdio: "ignore" });
  } catch {
    // já parado
  }
}

// Revisão visual rápida contra o servidor de teste (porta 3300): gera dados de teste pela tela de Manutenção e
// fotografa as telas principais no tema claro e escuro. Uso: node scripts/look.mjs <pasta-de-saída>
import fs from "node:fs";
import { chromium } from "@playwright/test";

const base = "http://localhost:3300";
const out = process.argv[2] ?? "look";
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR", extraHTTPHeaders: { "x-forwarded-for": "198.51.100.77" } });
const page = await context.newPage();

await page.goto(`${base}/login`);
await page.screenshot({ path: `${out}/login.png` });
await page.getByLabel("E-mail").fill("admin@e2e.local");
await page.getByLabel("Senha").fill("cavalo correto bateria e2e");
await page.getByRole("button", { name: "Entrar", exact: true }).click();
await page.waitForURL(/\/admin$/);

await page.goto(`${base}/admin/manutencao`);
if (await page.getByLabel("Quantidade").count()) {
  await page.getByLabel("Quantidade").fill("60");
  await page.getByRole("button", { name: "Gerar contatos de teste" }).click();
  await page.getByText(/contato\(s\) de teste criados/).waitFor();
}

const shots = [
  ["painel", "/admin"],
  ["contatos", "/contatos"],
  ["conta", "/conta"],
  ["usuarios", "/admin/usuarios"],
];
for (const theme of ["light", "dark"]) {
  await context.addCookies([{ name: "flash_theme", value: theme, url: base }]);
  for (const [name, path] of shots) {
    await page.goto(`${base}${path}`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/${name}-${theme}.png`, fullPage: name !== "contatos" });
  }
  const first = page.locator("tbody tr a").first();
  await page.goto(`${base}/contatos`);
  await first.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/detalhe-${theme}.png`, fullPage: true });
  await page.getByRole("button", { name: "Abrir discador" }).click();
  await page.keyboard.type("119");
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/discador-${theme}.png` });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Falar com o suporte" }).click();
  await page.screenshot({ path: `${out}/suporte-${theme}.png` });
}
await browser.close();
console.log(`capturas em ${out}/`);

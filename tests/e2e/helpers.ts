import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { Client } from "pg";
import { E2E_DATABASE_URL } from "../../playwright.config";

export const ADMIN = { email: "admin@e2e.local", password: "cavalo correto bateria e2e" };

// Terceiro octeto sorteado por arquivo: o contador recomeça a cada arquivo e IPs repetidos estourariam o
// limite de solicitações de acesso por IP (que está certo: o teste é que precisa de IPs únicos).
const ipBlock = Math.floor(Math.random() * 250);
let ipCounter = 10;
// Cada contexto "vem" de um IP diferente (o servidor confia no X-Forwarded-For, como atrás do proxy da plataforma),
// para o limite por IP de um teste não vazar para outro.
// Janelas abertas pelo teste fecham ao fim dele (cada uma mantém uma conexão de tempo real).
const openContexts: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(openContexts.splice(0).map((c) => c.close()));
});

export const newUserPage = async (browser: Browser) => {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `10.${ipBlock}.${Math.floor(ipCounter / 250)}.${ipCounter++ % 250}` } });
  openContexts.push(context);
  return context.newPage();
};

export const unique = (prefix: string) => `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@e2e.local`;

export const login = async (page: Page, email: string, password: string) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
};

export const loginAsAdmin = async (page: Page) => {
  await login(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL(/\/admin$/);
};

export const sql = async <T = Record<string, unknown>>(query: string, params: unknown[] = []) => {
  const client = new Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(query, params)).rows as T[];
  } finally {
    await client.end();
  }
};

// Marca a página: se ela recarregar, a marca some. Prova que a atualização veio por tempo real.
export const markNoReload = (page: Page) => page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
export const expectNoReload = async (page: Page) =>
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);

// Operador já aprovado, direto no banco (para testes que não são sobre o fluxo de aprovação).
export const createOperator = async (page: Page, admin: Page, name: string) => {
  const email = unique("op");
  const password = "uma frase longa de teste";
  await page.goto("/login");
  await page.getByRole("tab", { name: "Solicitar acesso" }).click();
  await page.getByLabel("Nome completo").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirme a senha").fill(password);
  await page.getByRole("button", { name: "Enviar solicitação" }).click();
  await expect(page.getByRole("heading", { name: "Aguardando aprovação" })).toBeVisible();
  await admin.goto("/admin/solicitacoes");
  await admin.getByRole("button", { name: `Aprovar ${name}` }).click();
  await expect(page.getByRole("heading", { name: "Acesso aprovado!" })).toBeVisible();
  await page.getByRole("button", { name: "Entrar agora" }).click();
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/contatos$/);
  return { email, password };
};

// Alerta do formulário (o Next também tem um role=alert: o anunciador de rota).
export const formAlert = (page: Page) => page.locator("[role=alert]:not(#__next-route-announcer__)");

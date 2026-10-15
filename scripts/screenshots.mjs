// Gera as capturas de tela da documentação (docs/screenshots) contra um servidor já rodando.
// Uso: node scripts/screenshots.mjs <url> <email-admin> <senha-admin> <email-operador> <senha-operador>
// PW_CHROMIUM_PATH aponta para um Chromium já instalado, se o do Playwright não estiver.
import fs from "node:fs";
import { chromium } from "@playwright/test";

const [base = "http://localhost:3000", adminEmail, adminPassword, opEmail, opPassword] = process.argv.slice(2);
const out = "docs/screenshots";
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const newPage = async (ip) =>
  (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR", extraHTTPHeaders: { "x-forwarded-for": ip } })).newPage();
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png`, fullPage: true });

const login = async (page, email, password) => {
  await page.goto(`${base}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
};

const admin = await newPage("198.51.100.1");
await admin.goto(`${base}/login`);
await shot(admin, "01-login");
await login(admin, adminEmail, adminPassword);

const visitor = await newPage("198.51.100.2");
await visitor.goto(`${base}/login`);
await visitor.getByRole("tab", { name: "Solicitar acesso" }).click();
await shot(visitor, "02-solicitar-acesso");
const stamp = Date.now();
await visitor.getByLabel("Nome completo").fill("Marcos Pereira");
await visitor.getByLabel("E-mail").fill(`marcos.${stamp}@exemplo.com`);
await visitor.getByLabel("Senha", { exact: true }).fill("uma frase bem longa aqui");
await visitor.getByLabel("Confirme a senha").fill("uma frase bem longa aqui");
await visitor.getByRole("button", { name: "Enviar solicitação" }).click();
await visitor.getByText("Conectado em tempo real").waitFor();
await shot(visitor, "03-aguardando-aprovacao");

await admin.goto(`${base}/admin`);
await admin.getByText("Tempo real").waitFor();
const operator = await newPage("198.51.100.3");
await login(operator, opEmail, opPassword);
await operator.goto(`${base}/contatos/novo`);
await shot(operator, "07-operador-novo-contato");
await operator.getByLabel("Nome completo").fill("Helena Batista");
await operator.getByLabel("Telefone (com DDD)").fill("(31) 99876-5432");
await operator.getByLabel("Cidade").fill("Belo Horizonte");
await operator.getByLabel("UF").selectOption("MG");
await operator.getByLabel("Origem", { exact: true }).selectOption("ESTUDOS");
await operator.getByRole("button", { name: "Salvar contato" }).click();
await operator.getByText("Contato cadastrado.").waitFor();
await shot(operator, "08-operador-meus-contatos");

await admin.getByText("cadastrou Helena Batista").waitFor();
await admin.waitForTimeout(1200);
await shot(admin, "04-admin-painel-notificacao");

await admin.goto(`${base}/admin/solicitacoes`);
await shot(admin, "05-admin-solicitacoes");
await admin.getByRole("button", { name: "Aprovar Marcos Pereira" }).click();
await visitor.getByRole("heading", { name: "Acesso aprovado!" }).waitFor();
await shot(visitor, "06-acesso-aprovado");

await admin.goto(`${base}/contatos`);
await shot(admin, "09-admin-contatos");
await admin.goto(`${base}/admin/usuarios`);
await shot(admin, "10-admin-usuarios");
await admin.goto(`${base}/admin/atividade`);
await shot(admin, "11-admin-atividade");
await admin.goto(`${base}/conta`);
await shot(admin, "12-conta-2fa");
await admin.goto(`${base}/design-system`);
await shot(admin, "13-design-system");

await browser.close();
console.log(`Capturas em ${out}/`);

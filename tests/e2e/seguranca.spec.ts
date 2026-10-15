import { expect, test } from "@playwright/test";
import { totpCodeForStep, currentStep } from "../../src/server/auth/totp";
import { ADMIN, createOperator, formAlert, login, loginAsAdmin, newUserPage, sql, unique } from "./helpers";

test("cabeçalhos de segurança e cookie de sessão protegido", async ({ browser }) => {
  const page = await newUserPage(browser);
  const response = await page.goto("/login");
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();

  await login(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL(/\/admin$/);
  const cookie = (await page.context().cookies()).find((c) => c.name.endsWith("flash_session"))!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Strict");
  expect(cookie.name).toBe("__Host-flash_session");
  expect(cookie.secure).toBe(true);
  // No banco fica só o hash do token, nunca o próprio token.
  const rows = await sql<{ id: string }>(`SELECT id FROM "Session" WHERE id = $1`, [cookie.value]);
  expect(rows).toHaveLength(0);
});

test("sem sessão, área logada e APIs de tempo real recusam acesso", async ({ browser }) => {
  const page = await newUserPage(browser);
  await page.goto("/admin/usuarios");
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/events")).status()).toBe(401);
  expect((await page.request.get("/api/signup-requests/stream")).status()).toBe(404);
  // Cookie forjado também não passa.
  await page.context().addCookies([{ name: "__Host-flash_session", value: "forjado", domain: "localhost", path: "/", secure: true, sameSite: "Strict" }]);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});

test("mensagem de erro não revela se o e-mail existe e a conta bloqueia após 5 erros", async ({ browser }) => {
  const page = await newUserPage(browser);
  const admin = await newUserPage(browser);
  await loginAsAdmin(admin);
  const { email, password } = await createOperator(await newUserPage(browser), admin, "Bia Bloqueio");

  await login(page, unique("ninguem"), "qualquer-senha-errada");
  const unknownMsg = await formAlert(page).textContent();
  await login(page, email, "senha-errada-1");
  expect(await formAlert(page).textContent()).toBe(unknownMsg);

  for (let i = 2; i <= 5; i++) await login(page, email, `senha-errada-${i}`);
  // Bloqueada: nem a senha certa entra, e a mensagem é a mesma.
  await login(page, email, password);
  await expect(formAlert(page)).toHaveText(unknownMsg!);
  await expect(page).toHaveURL(/\/login$/);

  const audit = await sql<{ action: string }>(`SELECT action FROM "AuditLog" WHERE action = 'auth.login_locked' AND "actorId" = (SELECT id FROM "User" WHERE email = $1)`, [email]);
  expect(audit.length).toBe(1);
});

test("operador não acessa telas nem ações de administrador", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  await loginAsAdmin(admin);
  await createOperator(operator, admin, "Oscar Restrito");

  for (const path of ["/admin", "/admin/usuarios", "/admin/solicitacoes", "/admin/atividade", "/notificacoes"]) {
    await operator.goto(path);
    await expect(operator).toHaveURL(/\/contatos$/);
  }
});

test("operador só vê os próprios contatos", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const a = await newUserPage(browser);
  const b = await newUserPage(browser);
  await loginAsAdmin(admin);
  await createOperator(a, admin, "Amanda Alfa");
  await createOperator(b, admin, "Beto Beta");

  await a.goto("/contatos/novo");
  await a.getByLabel("Nome completo").fill("Segredo da Amanda");
  await a.getByLabel("Telefone (com DDD)").fill("21987654321");
  await a.getByLabel("Cidade").fill("Niterói");
  await a.getByLabel("UF").selectOption("RJ");
  await a.getByLabel("Origem", { exact: true }).selectOption("TRABALHO");
  await a.getByRole("button", { name: "Salvar contato" }).click();
  await expect(a.getByRole("link", { name: "Segredo da Amanda", exact: true })).toBeVisible();

  // Nem buscando, nem filtrando pelo id da outra operadora.
  const amandaId = (await sql<{ id: string }>(`SELECT id FROM "User" WHERE name = 'Amanda Alfa'`))[0]!.id;
  await b.goto(`/contatos?q=Segredo&operador=${amandaId}`);
  await expect(b.getByText("Nenhum contato com estes filtros")).toBeVisible();
});

test("desativar um usuário derruba a sessão aberta dele em tempo real", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  await loginAsAdmin(admin);
  await createOperator(operator, admin, "Davi Desligado");
  await expect(operator.getByText("Tempo real")).toBeVisible();

  await admin.goto("/admin/usuarios");
  await admin.getByRole("button", { name: "Desativar Davi Desligado" }).click();
  await expect(admin.getByText("Usuário desativado e desconectado.")).toBeVisible();

  await expect(operator).toHaveURL(/\/login$/);
});

test("2FA: ativar com código do autenticador e exigir o código no login", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  await loginAsAdmin(admin);
  const { email, password } = await createOperator(operator, admin, "Tânia Totp");

  await operator.goto("/conta");
  const secret = (await operator.locator("code").first().textContent())!.replace(/\s/g, "");
  await operator.getByLabel("Código").fill(totpCodeForStep(secret, currentStep()));
  // Ativar exige a senha: sessão roubada não amarra a conta ao celular de outra pessoa.
  await operator.getByLabel("Sua senha").fill("senha-errada-qualquer");
  await operator.getByRole("button", { name: "Ativar 2FA" }).click();
  await expect(formAlert(operator)).toHaveText("Senha incorreta.");
  // O formulário é limpo depois da action: código e senha de novo.
  await operator.getByLabel("Código").fill(totpCodeForStep(secret, currentStep()));
  await operator.getByLabel("Sua senha").fill(password);
  await operator.getByRole("button", { name: "Ativar 2FA" }).click();
  await expect(operator.getByText("Ativa", { exact: true })).toBeVisible();

  await operator.context().clearCookies();
  await login(operator, email, password);
  await expect(operator).toHaveURL(/\/login\/verificar$/);
  await operator.getByLabel("Código").fill("000000");
  await operator.getByRole("button", { name: "Verificar" }).click();
  await expect(formAlert(operator)).toHaveText("Código inválido ou expirado.");

  // O código usado na ativação não vale de novo: usa o do próximo passo de 30 s.
  await operator.getByLabel("Código").fill(totpCodeForStep(secret, currentStep() + 1));
  await operator.getByRole("button", { name: "Verificar" }).click();
  await expect(operator).toHaveURL(/\/contatos$/);
});

test("2FA: saber a senha não dá tentativas ilimitadas de código (bloqueia a conta)", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  await loginAsAdmin(admin);
  const { email, password } = await createOperator(operator, admin, "Felipe Forçabruta");

  await operator.goto("/conta");
  const secret = (await operator.locator("code").first().textContent())!.replace(/\s/g, "");
  await operator.getByLabel("Código").fill(totpCodeForStep(secret, currentStep()));
  await operator.getByLabel("Sua senha").fill(password);
  await operator.getByRole("button", { name: "Ativar 2FA" }).click();
  await expect(operator.getByText("Ativa", { exact: true })).toBeVisible();
  await operator.context().clearCookies();

  // Atacante com a senha chuta códigos: cada erro conta no bloqueio da conta, não só no desafio.
  await login(operator, email, password);
  await expect(operator).toHaveURL(/\/login\/verificar$/);
  for (let i = 0; i < 5; i++) {
    await operator.getByLabel("Código").fill(String(100000 + i));
    // Espera a resposta de cada envio (o formulário é limpo ao fim de cada action).
    await Promise.all([
      operator.waitForResponse((r) => r.request().method() === "POST"),
      operator.getByRole("button", { name: "Verificar" }).click(),
    ]);
  }

  // Conta bloqueada: nem a senha certa leva ao 2FA.
  await login(operator, email, password);
  await expect(operator).toHaveURL(/\/login$/);
  await expect(formAlert(operator)).toContainText("E-mail ou senha incorretos");
  const locked = await sql<{ lockedUntil: Date | null }>(`SELECT "lockedUntil" FROM "User" WHERE email = $1`, [email]);
  expect(locked[0]!.lockedUntil).not.toBeNull();
});

test("CSP sem 'unsafe-inline' em estilos e nenhuma tela com estilo bloqueado (gráficos, mapa, avatar, catálogo)", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const violations: string[] = [];
  admin.on("console", (m) => {
    if (/Content Security Policy/i.test(m.text())) violations.push(`${admin.url()}: ${m.text()}`);
  });

  const response = await admin.goto("/login");
  const csp = response!.headers()["content-security-policy"] ?? "";
  expect(csp).toMatch(/style-src 'self' 'nonce-[^']+'/);
  expect(csp).not.toContain("unsafe-inline");

  await loginAsAdmin(admin);
  const { id: adminId } = (await sql<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [ADMIN.email]))[0]!;
  const contactId = `csp-${Date.now()}`;
  await sql(
    `INSERT INTO "Contact" (id, name, phone, city, state, origin, "createdById") VALUES ($1, 'Clara Estilo', '11988887777', 'São Paulo', 'SP', 'FAMILIA', $2)`,
    [contactId, adminId],
  );

  await admin.goto("/admin");
  await expect(admin.locator(".recharts-surface").first()).toBeVisible(); // gráfico desenhado no navegador
  // Mapa do Brasil: SP na coluna 3, linha 6 da grade (antes vinha de style=).
  const sp = admin.getByRole("listitem").filter({ hasText: /^SP/ }).first();
  await expect(sp).toHaveCSS("grid-row-start", "6");

  await admin.goto(`/contatos/${contactId}`);
  await expect(admin.locator("main span[aria-hidden]").filter({ hasText: /^CE$/ }).first()).toHaveCSS("width", "56px");

  for (const path of ["/contatos", "/admin/atividade", "/design-system"]) {
    await admin.goto(path);
    await expect(admin.locator("main")).toBeVisible();
  }
  expect(violations).toEqual([]);
});

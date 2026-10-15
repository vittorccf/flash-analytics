import { expect, test, type Page } from "@playwright/test";
import { createOperator, loginAsAdmin, newUserPage, sql } from "./helpers";

const addContact = async (page: Page, name: string, phone: string, city = "São Paulo") => {
  await page.goto("/contatos/novo");
  // Escolher opções antes de a página "hidratar" faz o React voltar a lista ao valor inicial: espera ficar pronta.
  await expect(page.getByText("Tempo real")).toBeVisible();
  await page.getByLabel("Nome completo").fill(name);
  await page.getByLabel("Telefone (com DDD)").fill(phone);
  await page.getByLabel("Cidade").fill(city);
  await page.getByLabel("UF").selectOption("SP");
  await page.getByLabel("Origem", { exact: true }).selectOption("TRABALHO");
  await expect(page.getByLabel("UF", { exact: true })).toHaveValue("SP");
  await expect(page.getByLabel("Origem", { exact: true })).toHaveValue("TRABALHO");
  await page.getByRole("button", { name: "Salvar contato" }).click();
};

const setPermissions = async (admin: Page, userName: string, preset: string) => {
  const { id } = (await sql<{ id: string }>(`SELECT id FROM "User" WHERE name = $1`, [userName]))[0]!;
  await admin.goto(`/admin/usuarios/${id}`);
  await admin.getByRole("button", { name: preset, exact: true }).click();
  await admin.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(admin.getByText("Alterações salvas.")).toBeVisible();
};

test("Leitor vê a equipe mas não cria, edita nem apaga (inclusive pela URL)", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const author = await newUserPage(browser);
  const reader = await newUserPage(browser);
  await loginAsAdmin(admin);
  await createOperator(author, admin, "Alice Autora");
  await createOperator(reader, admin, "Leo Leitor");
  await addContact(author, "Contato da Alice", "11987001001");

  await setPermissions(admin, "Leo Leitor", "Leitor");
  await reader.goto("/contatos");
  await expect(reader.getByRole("link", { name: "Contato da Alice", exact: true })).toBeVisible();
  await expect(reader.getByRole("link", { name: "Novo contato" })).toHaveCount(0);

  await reader.goto("/contatos/novo");
  await expect(reader).toHaveURL(/aviso=sem-permissao/);
  await reader.getByRole("link", { name: "Contato da Alice", exact: true }).click();
  await expect(reader.getByRole("link", { name: "Editar" })).toHaveCount(0);
  await expect(reader.getByRole("button", { name: "Excluir" })).toHaveCount(0);
  expect((await reader.request.get("/api/contatos/exportar?formato=csv")).status()).toBe(403);
});

test("aviso de duplicado: mostra o contato existente e só salva confirmando", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  await loginAsAdmin(admin);
  await createOperator(operator, admin, "Davi Duplo");
  await addContact(operator, "Primeiro Cadastro", "11987002002");
  await expect(operator.getByText("Contato cadastrado.")).toBeVisible();

  await addContact(operator, "Mesmo Número", "(11) 98700-2002");
  await expect(operator.getByText("Parece que este contato já existe")).toBeVisible();
  await expect(operator.getByRole("link", { name: "Primeiro Cadastro", exact: true })).toBeVisible();
  await operator.getByRole("button", { name: "Salvar mesmo assim" }).click();
  await expect(operator.getByText("Contato cadastrado.")).toBeVisible();
});

test("ordenar por coluna, favoritar e filtrar favoritos", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  await loginAsAdmin(admin);
  await createOperator(operator, admin, "Otto Ordem");
  await addContact(operator, "Zélia Última", "11987003001");
  await addContact(operator, "Abel Primeiro", "11987003002");

  await operator.getByRole("link", { name: /^Nome/ }).click();
  await expect(operator).toHaveURL(/ordem=nome/);
  await expect(operator.locator("tbody tr").first()).toContainText("Abel Primeiro");
  await operator.getByRole("link", { name: /^Nome/ }).click();
  await expect(operator).toHaveURL(/ordem=-nome/);
  await expect(operator.locator("tbody tr").first()).toContainText("Zélia Última");

  await operator.getByRole("button", { name: "Adicionar Abel Primeiro aos favoritos" }).click();
  await expect(operator.getByRole("button", { name: "Tirar Abel Primeiro dos favoritos" })).toBeVisible();
  await operator.getByLabel("Só favoritos").check();
  await operator.getByRole("button", { name: "Filtrar" }).click();
  await expect(operator.locator("tbody tr")).toHaveCount(1);
});

test("notas, histórico de auditoria e cartão (.vcf) no detalhe do contato", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  await loginAsAdmin(admin);
  await createOperator(operator, admin, "Nina Notas");
  await addContact(operator, "Contato Anotado", "11987004001");
  await operator.getByRole("link", { name: "Contato Anotado", exact: true }).click();

  await operator.getByLabel("Nova nota").fill("Liguei, pediu retorno na sexta.");
  await operator.getByRole("button", { name: "Adicionar nota" }).click();
  await expect(operator.getByText("Liguei, pediu retorno na sexta.")).toBeVisible();

  await operator.getByRole("link", { name: "Editar" }).click();
  await operator.getByLabel("Cidade").fill("Campinas");
  await operator.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(operator.getByText("Editou contato")).toBeVisible();
  await expect(operator.getByText("Campos: Cidade")).toBeVisible();
  await expect(operator.getByText("Escreveu nota")).toBeVisible();

  await operator.getByRole("button", { name: "Compartilhar contato" }).click();
  const [download] = await Promise.all([operator.waitForEvent("download"), operator.getByRole("menuitem", { name: "Baixar cartão (.vcf)" }).click()]);
  const vcard = Buffer.concat(await (await download.createReadStream()).toArray()).toString("utf8");
  expect(vcard).toContain("FN:Contato Anotado");
  expect(vcard).toContain("TEL;TYPE=CELL:+5511987004001");
});

test("foto do contato: aceita PNG, recusa arquivo que finge ser imagem e só abre para quem vê o contato", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  const other = await newUserPage(browser);
  await loginAsAdmin(admin);
  await createOperator(operator, admin, "Fabi Foto");
  await createOperator(other, admin, "Olavo Outro");
  await addContact(operator, "Contato com Foto", "11987006001");
  await operator.getByRole("link", { name: "Contato com Foto", exact: true }).click();
  await operator.waitForURL(/\/contatos\/(?!novo)[^/?]+$/);
  const id = operator.url().split("/").pop()!;

  await operator.getByLabel("Nova foto").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
  await operator.getByRole("button", { name: "Salvar foto" }).click();
  await expect(operator.getByText("Foto atualizada.")).toBeVisible();
  await expect(operator.getByText("Trocou a foto do contato")).toBeVisible();
  expect((await operator.request.get(`/api/contatos/${id}/foto`)).status()).toBe(200);
  // Outro operador não vê o contato, então também não vê a foto.
  expect((await other.request.get(`/api/contatos/${id}/foto`)).status()).toBe(404);

  await operator.getByLabel("Nova foto").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: Buffer.from('<svg onload="alert(1)"/>') });
  await operator.getByRole("button", { name: "Salvar foto" }).click();
  await expect(operator.getByText("Use uma imagem PNG, JPEG ou WebP.")).toBeVisible();
});

test("tema escuro, busca no topo e discador", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  await loginAsAdmin(admin);
  await createOperator(operator, admin, "Bia Busca");
  await addContact(operator, "Contato Buscável", "11987005001");

  await operator.getByRole("button", { name: /^Tema:/ }).click();
  await operator.getByRole("menuitem", { name: /Escuro/ }).click();
  await expect(operator.locator("html")).toHaveAttribute("data-theme", "dark");
  await operator.reload();
  await expect(operator.locator("html")).toHaveAttribute("data-theme", "dark");

  await operator.keyboard.press("Control+k");
  await operator.keyboard.type("Buscáv");
  await expect(operator.getByRole("option", { name: /Contato Buscável/ })).toBeVisible();
  await operator.keyboard.press("ArrowDown");
  await operator.keyboard.press("Enter");
  await expect(operator.getByRole("heading", { name: "Contato Buscável" })).toBeVisible();

  await operator.getByRole("button", { name: "Abrir discador" }).click();
  // Numa tela de 720 px o discador inteiro cabe (antes a parte de baixo ficava cortada, sem rolagem).
  await expect(operator.getByRole("button", { name: "0", exact: true })).toBeInViewport();
  for (const d of "11987005001") await operator.getByRole("button", { name: d, exact: true }).click();
  await expect(operator.getByRole("link", { name: "Ligar" })).toHaveAttribute("href", "tel:+5511987005001");
  await expect(operator.getByRole("link", { name: "Ligar" })).toBeInViewport();
  await expect(operator.getByRole("dialog").getByRole("button", { name: /Contato Buscável/ })).toBeVisible();
});

test("manutenção: dados de teste, limpeza agendada protegida e limpar a base com dupla confirmação", async ({ browser }) => {
  const admin = await newUserPage(browser);
  await loginAsAdmin(admin);
  await admin.goto("/admin/manutencao");
  await admin.getByLabel("Quantidade").fill("30");
  await admin.getByRole("button", { name: "Gerar contatos de teste" }).click();
  await expect(admin.getByText("30 contato(s) de teste criados.")).toBeVisible();

  await admin.getByRole("button", { name: "Rodar limpeza agora" }).click();
  await expect(admin.getByText(/Limpeza feita|Nada para limpar/)).toBeVisible();
  expect((await admin.request.get("/api/cron/limpeza")).status()).toBe(401);

  await admin.getByLabel("Sua senha").fill("cavalo correto bateria e2e");
  await admin.getByLabel('Digite "LIMPAR" para confirmar').fill("limpar");
  await admin.getByRole("button", { name: "Limpar a base" }).click();
  await expect(admin.getByText("Digite LIMPAR (em maiúsculas) para confirmar.")).toBeVisible();

  await admin.getByLabel("Sua senha").fill("cavalo correto bateria e2e");
  await admin.getByLabel('Digite "LIMPAR" para confirmar').fill("LIMPAR");
  await admin.getByRole("button", { name: "Limpar a base" }).click();
  await expect(admin.getByText(/Base limpa/)).toBeVisible();
  expect(await sql(`SELECT 1 FROM "Contact"`)).toHaveLength(0);
  expect((await sql(`SELECT 1 FROM "AuditLog" WHERE action = 'system.data_reset'`)).length).toBeGreaterThan(0);
});

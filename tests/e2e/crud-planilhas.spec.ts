import { expect, test } from "@playwright/test";
import { createOperator, loginAsAdmin, newUserPage, sql } from "./helpers";

const fillContact = async (page: import("@playwright/test").Page, name: string, phone: string) => {
  await page.goto("/contatos/novo");
  // Escolher opções antes de a página "hidratar" faz o React voltar a lista ao valor inicial: espera ficar pronta.
  await expect(page.getByText("Tempo real")).toBeVisible();
  await page.getByLabel("Nome completo").fill(name);
  await page.getByLabel("Telefone (com DDD)").fill(phone);
  await page.getByLabel("Cidade").fill("São Paulo");
  await page.getByLabel("UF").selectOption("SP");
  await page.getByLabel("Origem", { exact: true }).selectOption("TRABALHO");
  await page.getByRole("button", { name: "Salvar contato" }).click();
  await expect(page.getByText("Contato cadastrado.")).toBeVisible();
};

test("contato: ver, editar e excluir; operador não alcança contato de outro", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  const intruder = await newUserPage(browser);
  await loginAsAdmin(admin);
  await createOperator(operator, admin, "Otávio Crud");
  await createOperator(intruder, admin, "Iara Intrusa");
  await fillContact(operator, "Carlos Editável", "11987650000");

  await operator.getByRole("link", { name: "Carlos Editável", exact: true }).click();
  await operator.waitForURL(/\/contatos\/(?!novo)[^/?]+$/);
  const url = operator.url();
  await operator.getByRole("link", { name: "Editar" }).click();
  await operator.getByLabel("Nome completo").fill("Carlos Editado");
  await operator.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(operator.getByText("Contato atualizado.")).toBeVisible();
  await expect(operator.getByRole("heading", { name: "Carlos Editado" })).toBeVisible();

  // Outro operador: o mesmo endereço responde como inexistente (página de não encontrado, nenhum dado do contato).
  await intruder.goto(url);
  await expect(intruder.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  await expect(intruder.getByText("Carlos Editado")).toHaveCount(0);

  await operator.getByRole("button", { name: "Excluir" }).click();
  await operator.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(operator.getByText("Contato excluído.")).toBeVisible();
  expect(await sql(`SELECT 1 FROM "Contact" WHERE name = 'Carlos Editado'`)).toHaveLength(0);
});

test("WhatsApp: celular disponível, fixo opaco (desabilitado); ligar, SMS e e-mail com opções", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  await loginAsAdmin(admin);
  await createOperator(operator, admin, "Wagner Zap");
  await fillContact(operator, "Celia Celular", "11987651111");
  await fillContact(operator, "Fabio Fixo", "1133332222");

  const mobileRow = operator.getByRole("row", { name: /Celia Celular/ });
  await mobileRow.getByRole("button", { name: "WhatsApp de Celia" }).click();
  await expect(operator.getByRole("menuitem", { name: "Abrir no WhatsApp" })).toHaveAttribute("href", "https://wa.me/5511987651111");
  await operator.keyboard.press("Escape");

  const landlineRow = operator.getByRole("row", { name: /Fabio Fixo/ });
  await expect(landlineRow.getByRole("button", { name: "WhatsApp de Fabio" })).toHaveCount(0);
  await expect(landlineRow.getByRole("img", { name: /WhatsApp de Fabio: indisponível/ })).toBeVisible();

  await landlineRow.getByRole("button", { name: "Ligar ou enviar SMS para Fabio" }).click();
  await expect(operator.getByRole("menuitem", { name: "Ligar" })).toHaveAttribute("href", "tel:+551133332222");
  await expect(operator.getByRole("menuitem", { name: "Enviar SMS" })).toHaveAttribute("href", "sms:+551133332222");
});

test("exporta CSV e Excel e importa de volta (duplicados pulados, erros por linha)", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  await loginAsAdmin(admin);
  await createOperator(operator, admin, "Isadora Import");
  await fillContact(operator, "Exportado Um", "11987652222");

  await operator.goto("/contatos");
  await operator.getByRole("button", { name: "Exportar contatos" }).click();
  const [csvDownload] = await Promise.all([operator.waitForEvent("download"), operator.getByRole("menuitem", { name: "CSV" }).click()]);
  const csv = await (await csvDownload.createReadStream()).toArray();
  expect(Buffer.concat(csv).toString("utf8")).toContain("Exportado Um;(11) 98765-2222");

  const csvToImport = "\uFEFFNome;Telefone;Cidade;UF;Origem\r\nExportado Um;(11) 98765-2222;São Paulo;SP;Trabalho\r\nNova Pessoa;(21) 98765-3333;Rio de Janeiro;RJ;Amigos\r\nSem Telefone;;Recife;PE;\r\n";
  await operator.goto("/contatos/importar");
  await operator.getByLabel(/Planilha/).setInputFiles({ name: "contatos.csv", mimeType: "text/csv", buffer: Buffer.from(csvToImport) });
  await operator.getByRole("button", { name: "Importar contatos" }).click();
  await expect(operator.getByText("1 linha(s) com erro. Nada foi importado")).toBeVisible();
  await expect(operator.getByText(/Linha 4:/)).toBeVisible();

  await operator.getByLabel(/Planilha/).setInputFiles({ name: "contatos.csv", mimeType: "text/csv", buffer: Buffer.from(csvToImport) });
  await operator.getByLabel("Importar só as linhas válidas").check();
  await operator.getByRole("button", { name: "Importar contatos" }).click();
  await expect(operator.getByText("1 contato(s) importado(s).")).toBeVisible();
  expect(await sql(`SELECT 1 FROM "Contact" WHERE name = 'Nova Pessoa'`)).toHaveLength(1);
  expect(await sql(`SELECT 1 FROM "Contact" WHERE name = 'Exportado Um'`)).toHaveLength(1); // duplicado pulado

  const auditoria = await sql<{ action: string }>(`SELECT action FROM "AuditLog" WHERE action IN ('contact.exported', 'contact.imported')`);
  expect(auditoria.map((a) => a.action)).toEqual(expect.arrayContaining(["contact.exported", "contact.imported"]));
});

test("admin edita e exclui usuário; quem tem contatos só pode ser desativado", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  await loginAsAdmin(admin);
  const { email } = await createOperator(operator, admin, "Ursula Usuaria");

  const { id } = (await sql<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [email]))[0]!;
  await admin.goto(`/admin/usuarios/${id}`);
  await admin.getByLabel("Nome completo").fill("Ursula Renomeada");
  await admin.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(admin.getByText("Alterações salvas.")).toBeVisible();

  await admin.getByRole("button", { name: "Excluir usuário" }).click();
  await admin.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(admin.getByText("Usuário excluído.")).toBeVisible();
  // A sessão aberta da pessoa cai na hora.
  await expect(operator).toHaveURL(/\/login$/);

  const withContacts = await newUserPage(browser);
  await createOperator(withContacts, admin, "Tiago Comcontato");
  await fillContact(withContacts, "Contato do Tiago", "11987654444");
  const { id: tiagoId } = (await sql<{ id: string }>(`SELECT id FROM "User" WHERE name = 'Tiago Comcontato'`))[0]!;
  await admin.goto(`/admin/usuarios/${tiagoId}`);
  await expect(admin.getByText(/desative a conta em vez de excluir/i)).toBeVisible();
  await expect(admin.getByRole("button", { name: "Excluir usuário" })).toHaveCount(0);
});

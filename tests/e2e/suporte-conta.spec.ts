import { expect, test } from "@playwright/test";
import { createOperator, loginAsAdmin, newUserPage, sql } from "./helpers";

test("suporte: chamado gravado, admin avisado e WhatsApp do suporte com a mensagem pronta", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  await loginAsAdmin(admin);
  await createOperator(operator, admin, "Sofia Suporte");
  await admin.goto("/admin/suporte");

  await operator.getByRole("button", { name: "Falar com o suporte" }).click();
  await operator.getByLabel("Tipo de problema").selectOption("erro");
  await operator.getByLabel("Mensagem").fill("A lista de contatos não carregou depois do filtro.");
  await operator.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(operator.getByText(/Chamado registrado/)).toBeVisible();
  const whatsapp = await operator.getByRole("link", { name: "Enviar no WhatsApp" }).getAttribute("href");
  expect(whatsapp).toContain("https://wa.me/5564999368321?text=");
  expect(decodeURIComponent(whatsapp!)).toContain("A lista de contatos não carregou");

  // Admin vê o chamado em tempo real e resolve.
  await expect(admin.getByText("A lista de contatos não carregou depois do filtro.")).toBeVisible();
  await admin.getByRole("button", { name: "Marcar como resolvido" }).click();
  await expect(admin.getByText("Nenhum chamado aberto")).toBeVisible();
});

test("suporte na tela de login (sem conta) e o botão pode ser escondido e reaberto", async ({ browser }) => {
  const visitor = await newUserPage(browser);
  await visitor.goto("/login");
  await expect(visitor.getByText("vittorccf@gmail.com").first()).toBeVisible();

  await visitor.getByRole("button", { name: "Esconder botão de suporte" }).click();
  await expect(visitor.getByRole("button", { name: "Falar com o suporte" })).toHaveCount(0);
  await visitor.reload();
  await expect(visitor.getByRole("button", { name: "Falar com o suporte" })).toHaveCount(0);

  await visitor.evaluate(() => localStorage.removeItem("flash_support_hidden"));
  await visitor.reload();
  await visitor.getByRole("button", { name: "Falar com o suporte" }).click();
  await visitor.getByLabel("Tipo de problema").selectOption("acesso");
  await visitor.getByLabel("Mensagem").fill("Não lembro minha senha e preciso entrar hoje.");
  await visitor.getByLabel("E-mail ou telefone para retorno").fill("visitante@exemplo.com");
  await visitor.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(visitor.getByText(/Chamado registrado/)).toBeVisible();
  expect(await sql(`SELECT 1 FROM "SupportTicket" WHERE "replyTo" = 'visitante@exemplo.com'`)).toHaveLength(1);
});

test("Minha conta abre e usuário não tem foto de perfil (só contatos têm)", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  await loginAsAdmin(admin);
  await createOperator(operator, admin, "Paulo Perfil");

  await operator.goto("/conta");
  await expect(operator.getByRole("heading", { name: "Minha conta" })).toBeVisible();
  await expect(operator.getByText("Verificação em duas etapas")).toBeVisible();
  await expect(operator.getByText("Foto de perfil")).toHaveCount(0);

  const { id } = (await sql<{ id: string }>(`SELECT id FROM "User" WHERE name = 'Paulo Perfil'`))[0]!;
  await admin.goto(`/admin/usuarios/${id}`);
  await expect(admin.getByLabel("Nova foto")).toHaveCount(0);
});


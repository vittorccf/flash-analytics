import { expect, test } from "@playwright/test";
import { createOperator, expectNoReload, login, loginAsAdmin, markNoReload, newUserPage, sql, unique } from "./helpers";

test("operador pede acesso e vê a aprovação em tempo real, sem recarregar a tela", async ({ browser }) => {
  const operator = await newUserPage(browser);
  const admin = await newUserPage(browser);
  const email = unique("carlos");
  const password = "minha senha bem comprida";

  await operator.goto("/login");
  await operator.getByRole("tab", { name: "Solicitar acesso" }).click();
  await operator.getByLabel("Nome completo").fill("Carlos Operador");
  await operator.getByLabel("E-mail").fill(email);
  await operator.getByLabel("Senha", { exact: true }).fill(password);
  await operator.getByLabel("Confirme a senha").fill(password);
  await operator.getByRole("button", { name: "Enviar solicitação" }).click();
  await expect(operator.getByRole("heading", { name: "Aguardando aprovação" })).toBeVisible();
  await expect(operator.getByText("Conectado em tempo real")).toBeVisible();
  await markNoReload(operator);

  // Antes da aprovação, o login com a senha escolhida não funciona.
  await loginAsAdmin(admin);
  await admin.goto("/admin/solicitacoes");
  await expect(admin.getByText(email)).toBeVisible();
  await admin.getByRole("button", { name: "Aprovar Carlos Operador" }).click();

  await expect(operator.getByRole("heading", { name: "Acesso aprovado!" })).toBeVisible();
  await expectNoReload(operator);

  await operator.getByRole("button", { name: "Entrar agora" }).click();
  await expect(operator.getByLabel("E-mail")).toHaveValue(email);
  await operator.getByLabel("Senha").fill(password);
  await operator.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(operator).toHaveURL(/\/contatos$/);
  await expect(operator.getByRole("heading", { name: "Meus contatos" })).toBeVisible();
});

test("solicitação recusada aparece na hora para quem está esperando", async ({ browser }) => {
  const operator = await newUserPage(browser);
  const admin = await newUserPage(browser);
  const password = "outra senha bem comprida";

  await operator.goto("/login");
  await operator.getByRole("tab", { name: "Solicitar acesso" }).click();
  await operator.getByLabel("Nome completo").fill("Rita Recusada");
  await operator.getByLabel("E-mail").fill(unique("rita"));
  await operator.getByLabel("Senha", { exact: true }).fill(password);
  await operator.getByLabel("Confirme a senha").fill(password);
  await operator.getByRole("button", { name: "Enviar solicitação" }).click();
  await expect(operator.getByText("Conectado em tempo real")).toBeVisible();

  await loginAsAdmin(admin);
  await admin.goto("/admin/solicitacoes");
  await admin.getByRole("button", { name: "Recusar Rita Recusada" }).click();
  await admin.getByLabel("Motivo da recusa").fill("Pedido não reconhecido");
  await admin.getByRole("button", { name: "Recusar", exact: true }).click();

  await expect(operator.getByRole("heading", { name: "Solicitação não aprovada" })).toBeVisible();
  await expect(operator.getByText("Motivo: Pedido não reconhecido")).toBeVisible();
});

test("contato cadastrado pelo operador notifica o admin em tempo real e atualiza o painel", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  await loginAsAdmin(admin);
  await createOperator(operator, admin, "Olga Operadora");

  await admin.goto("/admin");
  await expect(admin.getByText("Tempo real")).toBeVisible();
  const before = Number((await admin.getByText("Contatos cadastrados").locator("..").locator("p").nth(1).textContent())?.replace(/\D/g, ""));
  await markNoReload(admin);

  await operator.goto("/contatos/novo");
  await operator.getByLabel("Nome completo").fill("Pedro Contato");
  await operator.getByLabel("Telefone (com DDD)").fill("(11) 98888-7777");
  await operator.getByLabel("E-mail (opcional)").fill("pedro@exemplo.com");
  await operator.getByLabel("Cidade").fill("Campinas");
  await operator.getByLabel("UF").selectOption("SP");
  await operator.getByLabel("Origem", { exact: true }).selectOption("AMIGOS");
  await operator.getByRole("button", { name: "Salvar contato" }).click();
  await expect(operator.getByText("Contato cadastrado.")).toBeVisible();
  await expect(operator.getByRole("link", { name: "Pedro Contato", exact: true })).toBeVisible();

  // Aviso na tela do admin, sem recarregar.
  await expect(admin.getByRole("status").filter({ hasText: "Olga Operadora cadastrou Pedro Contato." })).toBeVisible();
  await expect(admin.getByText("Contatos cadastrados").locator("..").locator("p").nth(1)).toHaveText(String(before + 1));
  await expectNoReload(admin);

  // Notificação persistida (aparece mesmo para quem estava fora).
  await admin.goto("/notificacoes");
  await expect(admin.getByText("Olga Operadora cadastrou Pedro Contato (Campinas/SP).")).toBeVisible();
});

test("formulário de contato valida no servidor e mantém o que foi digitado", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  await loginAsAdmin(admin);
  await createOperator(operator, admin, "Vera Validação");

  await operator.goto("/contatos/novo");
  await operator.getByLabel("Nome completo").fill("Fulano de Tal");
  await operator.getByLabel("Telefone (com DDD)").fill("123");
  await operator.getByRole("button", { name: "Salvar contato" }).click();
  await expect(operator.getByText("Informe um telefone com DDD")).toBeVisible();
  await expect(operator.getByText("Informe a cidade.")).toBeVisible();
  await expect(operator.getByLabel("Nome completo")).toHaveValue("Fulano de Tal");
});

test("CEP preenche o endereço automaticamente e, se falhar, o formulário segue manual", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  await loginAsAdmin(admin);
  await createOperator(operator, admin, "Cida Cep");

  await operator.goto("/contatos/novo");
  // CEP inexistente: avisa e deixa preencher à mão.
  await operator.getByLabel("CEP (opcional)").fill("99999999");
  await expect(operator.getByText("CEP não encontrado. Preencha o endereço manualmente.")).toBeVisible();
  // Serviço fora do ar: mesma coisa, sem travar o formulário.
  await operator.getByLabel("CEP (opcional)").fill("99999000");
  await expect(operator.getByText("Busca de CEP indisponível agora.")).toBeVisible();

  // CEP válido: máscara e preenchimento automático (campos continuam editáveis).
  await operator.getByLabel("CEP (opcional)").fill("01310100");
  await expect(operator.getByLabel("CEP (opcional)")).toHaveValue("01310-100");
  await expect(operator.getByText("Endereço preenchido pelo CEP.")).toBeVisible();
  await expect(operator.getByLabel("Logradouro (opcional)")).toHaveValue("Avenida Paulista");
  await expect(operator.getByLabel("Bairro (opcional)")).toHaveValue("Bela Vista");
  await expect(operator.getByLabel("Cidade")).toHaveValue("São Paulo");
  await expect(operator.getByLabel("UF")).toHaveValue("SP");
  await expect(operator.getByLabel("Número", { exact: true })).toBeFocused();

  await operator.getByLabel("Número", { exact: true }).fill("1578");
  await operator.getByLabel("Nome completo").fill("Paula Paulista");
  await operator.getByLabel("Telefone (com DDD)").fill("11987654321");
  await operator.getByLabel("Origem", { exact: true }).selectOption("TRABALHO");
  await operator.getByRole("button", { name: "Salvar contato" }).click();
  await expect(operator.getByText("Contato cadastrado.")).toBeVisible();
  await expect(operator.getByText("Bela Vista · CEP 01310-100")).toBeVisible();

  const saved = await sql<{ zipCode: string; street: string; number: string }>(
    `SELECT "zipCode", street, number FROM "Contact" WHERE name = 'Paula Paulista'`,
  );
  expect(saved[0]).toEqual({ zipCode: "01310100", street: "Avenida Paulista", number: "1578" });
});

test("admin também cadastra contato; os outros admins são avisados, ele não", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const otherAdmin = await newUserPage(browser);
  await loginAsAdmin(admin);

  // Segundo admin, criado pelo primeiro (senha provisória → troca obrigatória).
  const email = unique("admin2");
  await admin.goto("/admin/usuarios");
  await admin.getByLabel("Nome completo").fill("Beatriz Gestora");
  await admin.getByLabel("E-mail").fill(email);
  await admin.getByLabel("Perfil").selectOption("ADMIN");
  await admin.getByRole("button", { name: "Criar usuário" }).click();
  const temporary = (await admin.locator("code").first().textContent())!.trim();
  await login(otherAdmin, email, temporary);
  await otherAdmin.getByLabel("Senha atual").fill(temporary);
  await otherAdmin.getByLabel("Nova senha", { exact: true }).fill("uma frase longa e nova");
  await otherAdmin.getByLabel("Confirme a nova senha").fill("uma frase longa e nova");
  await otherAdmin.getByRole("button", { name: "Trocar senha" }).click();
  await expect(otherAdmin).toHaveURL(/\/admin$/);
  await expect(otherAdmin.getByText("Tempo real")).toBeVisible();

  await admin.goto("/contatos");
  await admin.getByRole("link", { name: "Novo contato" }).click();
  await admin.getByLabel("Nome completo").fill("Contato do Admin");
  await admin.getByLabel("Telefone (com DDD)").fill("21976540001");
  await admin.getByLabel("Cidade").fill("Niterói");
  await admin.getByLabel("UF").selectOption("RJ");
  await admin.getByLabel("Origem", { exact: true }).selectOption("AMIGOS");
  await admin.getByRole("button", { name: "Salvar contato" }).click();
  await expect(admin.getByText("Os outros administradores foram notificados.")).toBeVisible();
  await expect(admin.getByRole("link", { name: "Contato do Admin", exact: true })).toBeVisible();

  // O outro admin recebe o aviso; quem cadastrou não recebe aviso do próprio contato.
  await expect(otherAdmin.getByRole("status").filter({ hasText: "Admin E2E cadastrou Contato do Admin." })).toBeVisible();
  await expect(admin.getByRole("status").filter({ hasText: "cadastrou Contato do Admin." })).toHaveCount(0);
});

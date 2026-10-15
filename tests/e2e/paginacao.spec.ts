import { expect, test } from "@playwright/test";
import { createOperator, loginAsAdmin, newUserPage, sql } from "./helpers";

test("lista de contatos é paginada no servidor por cursor (10 por página), inclusive na ordem escolhida", async ({ browser }) => {
  const admin = await newUserPage(browser);
  const operator = await newUserPage(browser);
  await loginAsAdmin(admin);
  await createOperator(operator, admin, "Paula Paginada");

  const { id } = (await sql<{ id: string }>(`SELECT id FROM "User" WHERE name = 'Paula Paginada'`))[0]!;
  // 23 contatos: 3 páginas (10 + 10 + 3), com horários distintos para a ordem ser previsível.
  for (let i = 1; i <= 23; i++) {
    await sql(
      `INSERT INTO "Contact" (id, name, phone, city, state, origin, "createdById", "createdAt")
       VALUES ($1, $2, '11999990000', 'São Paulo', 'SP', 'TRABALHO', $3, now() AT TIME ZONE 'UTC' - make_interval(mins => $4))`,
      [`pag-${Date.now()}-${i}`, `Contato Paginado ${String(i).padStart(2, "0")}`, id, i],
    );
  }
  const name = (n: number) => operator.getByRole("link", { name: `Contato Paginado ${String(n).padStart(2, "0")}`, exact: true });

  await operator.goto("/contatos");
  // O total vem dos agregados do painel (mantidos por trigger), não de um count(*) na tabela.
  await expect(operator.getByText("23 contatos")).toBeVisible();
  await expect(operator.getByRole("row")).toHaveCount(11); // cabeçalho + 10
  await expect(name(1)).toBeVisible();
  await expect(operator.getByText("Anterior")).toHaveAttribute("aria-hidden", "true"); // primeira página

  await operator.getByRole("link", { name: "Próxima página" }).click();
  await expect(operator).toHaveURL(/apos=/);
  await expect(name(11)).toBeVisible();
  await expect(name(10)).toHaveCount(0);

  await operator.getByRole("link", { name: "Próxima página" }).click();
  await expect(operator.getByRole("row")).toHaveCount(4);
  await expect(name(23)).toBeVisible();
  await expect(operator.getByText("Próxima")).toHaveAttribute("aria-hidden", "true"); // última página

  // Voltar devolve a página do meio, na mesma ordem.
  await operator.getByRole("link", { name: "Página anterior" }).click();
  await expect(operator).toHaveURL(/antes=/);
  await expect(operator.getByRole("row")).toHaveCount(11);
  await expect(name(11)).toBeVisible();
  await expect(name(20)).toBeVisible();

  // Ordem por nome (Z→A) também pagina pelo cursor.
  await operator.goto("/contatos?ordem=-nome");
  await expect(name(23)).toBeVisible();
  await operator.getByRole("link", { name: "Próxima página" }).click();
  await expect(name(13)).toBeVisible();
  await expect(name(14)).toHaveCount(0);

  // Cursor adulterado ou tamanho inventado não quebram nem liberam consultas enormes: primeira página.
  await operator.goto("/contatos?apos=lixo!!&por=100000");
  await expect(operator.getByRole("row")).toHaveCount(11);
  await expect(name(1)).toBeVisible();
  await operator.goto(`/contatos?apos=${Buffer.from(JSON.stringify(["nome", "x", "y"])).toString("base64url")}`);
  await expect(name(1)).toBeVisible(); // cursor de outra ordenação é ignorado
});

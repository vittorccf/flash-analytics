import { describe, expect, it } from "vitest";
import { cursorPaginate, decodeCursor, encodeCursor, parseCursorRequest } from "@/lib/cursor";
import { contactCursor, keysetOrderBy, keysetWhere } from "@/lib/contact-sort";

describe("cursor: codificação e validação", () => {
  it("ida e volta preserva os valores", () => {
    const raw = encodeCursor(["nome", "Ana Lúcia", "c1"]);
    expect(raw).toMatch(/^[\w-]+$/);
    expect(decodeCursor(raw, 3)).toEqual(["nome", "Ana Lúcia", "c1"]);
  });

  it("cursor adulterado, de outro tamanho ou gigante vale como primeira página", () => {
    expect(decodeCursor("não-é-base64!", 3)).toBeNull();
    expect(decodeCursor(encodeCursor(["a", "b"]), 3)).toBeNull();
    expect(decodeCursor(Buffer.from('{"a":1}').toString("base64url"), 3)).toBeNull();
    expect(decodeCursor(encodeCursor(["x", "y".repeat(300), "z"]), 3)).toBeNull();
    expect(decodeCursor("A".repeat(600), 3)).toBeNull();
  });

  it("lê ?apos, ?antes e o tamanho fechado da página", () => {
    const c = encodeCursor(["cadastro", "2026-10-01T10:00:00.000Z", "id1"]);
    expect(parseCursorRequest({ apos: c, por: "20" }, 3)).toMatchObject({ direction: "after", pageSize: 20, cursor: ["cadastro", "2026-10-01T10:00:00.000Z", "id1"] });
    expect(parseCursorRequest({ antes: c }, 3)).toMatchObject({ direction: "before", pageSize: 10 });
    expect(parseCursorRequest({ por: "100000" }, 3)).toMatchObject({ cursor: null, direction: "after", pageSize: 10 });
  });
});

describe("cursorPaginate", () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({ id: String(i + 1).padStart(2, "0") }));
  // Simula o banco: ordem crescente por id; "before" devolve na ordem inversa.
  const find = async ({ cursor, direction, take }: { cursor: string[] | null; direction: "after" | "before"; take: number }) =>
    direction === "after"
      ? rows.filter((r) => !cursor || r.id > cursor[0]!).slice(0, take)
      : rows.filter((r) => r.id < cursor![0]!).reverse().slice(0, take);
  const req = (cursor: string | null, direction: "after" | "before" = "after") => ({ cursor: cursor ? [cursor] : null, direction, pageSize: 10 });

  it("primeira página: sem anterior, com próxima", async () => {
    const p = await cursorPaginate(req(null), find, (r) => [r.id]);
    expect(p.items.map((r) => r.id)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]);
    expect(p.prev).toBeNull();
    expect(decodeCursor(p.next!, 1)).toEqual(["10"]);
  });

  it("última página: sem próxima", async () => {
    const p = await cursorPaginate(req("20"), find, (r) => [r.id]);
    expect(p.items.map((r) => r.id)).toEqual(["21", "22", "23", "24", "25"]);
    expect(p.next).toBeNull();
    expect(decodeCursor(p.prev!, 1)).toEqual(["21"]);
  });

  it("voltar devolve a página anterior na ordem certa e sabe quando chegou ao início", async () => {
    const p = await cursorPaginate(req("11", "before"), find, (r) => [r.id]);
    expect(p.items.map((r) => r.id)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]);
    expect(p.prev).toBeNull();
    expect(decodeCursor(p.next!, 1)).toEqual(["10"]);
  });
});

describe("keyset da lista de contatos", () => {
  const contact = { id: "c9", name: "Bruno", city: "Recife", origin: "TRABALHO" as const, createdAt: new Date("2026-10-01T12:00:00.000Z") };

  it("o cursor carrega a coluna da ordenação", () => {
    expect(contactCursor({ key: "nome", dir: "asc" })(contact)).toEqual(["nome", "Bruno", "c9"]);
    expect(contactCursor({ key: "cadastro", dir: "desc" })(contact)).toEqual(["cadastro", "2026-10-01T12:00:00.000Z", "c9"]);
  });

  it("A→Z avança com 'maior que' e desempata pelo id", () => {
    expect(keysetWhere({ key: "nome", dir: "asc" }, ["nome", "Bruno", "c9"], "after")).toEqual({
      OR: [{ name: { gt: "Bruno" } }, { name: "Bruno", id: { gt: "c9" } }],
    });
  });

  it("mais recentes primeiro avança com 'menor que'; voltar inverte", () => {
    const at = new Date("2026-10-01T12:00:00.000Z");
    expect(keysetWhere({ key: "cadastro", dir: "desc" }, ["cadastro", at.toISOString(), "c9"], "after")).toEqual({
      OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: "c9" } }],
    });
    expect(keysetWhere({ key: "cadastro", dir: "desc" }, ["cadastro", at.toISOString(), "c9"], "before")).toEqual({
      OR: [{ createdAt: { gt: at } }, { createdAt: at, id: { gt: "c9" } }],
    });
    expect(keysetOrderBy({ key: "cadastro", dir: "desc" }, "before")).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
  });

  it("origem (enum) avança pela ordem do enum", () => {
    expect(keysetWhere({ key: "origem", dir: "asc" }, ["origem", "ESTUDOS", "c9"], "after")).toEqual({
      OR: [{ origin: { in: ["SERVICOS", "OUTRO"] } }, { origin: "ESTUDOS", id: { gt: "c9" } }],
    });
  });

  it("cursor de outra ordenação, data inválida ou origem desconhecida é ignorado", () => {
    expect(keysetWhere({ key: "nome", dir: "asc" }, ["cidade", "Recife", "c9"], "after")).toBeNull();
    expect(keysetWhere({ key: "cadastro", dir: "desc" }, ["cadastro", "ontem", "c9"], "after")).toBeNull();
    expect(keysetWhere({ key: "origem", dir: "asc" }, ["origem", "PROSPECCAO", "c9"], "after")).toBeNull();
  });
});

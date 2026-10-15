// Ordenação da lista de contatos por coluna (?ordem=nome, ?ordem=-cidade…). Só campos de uma lista fechada:
// a URL é dado do cliente e não escolhe coluna arbitrária do banco.
import type { ContactOrigin, Prisma } from "@/generated/prisma/client";
import type { CursorDirection } from "./cursor";
import { ORIGINS } from "./labels";

export const SORT_FIELDS = {
  nome: "name",
  cidade: "city",
  origem: "origin",
  cadastro: "createdAt",
} as const;

export type SortKey = keyof typeof SORT_FIELDS;
export type ContactSort = { key: SortKey; dir: "asc" | "desc" };

export const DEFAULT_SORT: ContactSort = { key: "cadastro", dir: "desc" };

export const parseSort = (value: unknown): ContactSort => {
  if (typeof value !== "string") return DEFAULT_SORT;
  const dir = value.startsWith("-") ? "desc" : "asc";
  const key = value.replace(/^-/, "");
  return key in SORT_FIELDS ? { key: key as SortKey, dir } : DEFAULT_SORT;
};

export const sortParam = (sort: ContactSort) => (sort.key === DEFAULT_SORT.key && sort.dir === DEFAULT_SORT.dir ? undefined : `${sort.dir === "desc" ? "-" : ""}${sort.key}`);

// Clicar na coluna já ordenada inverte; numa coluna nova, texto começa A→Z e data começa pela mais recente.
export const nextSort = (current: ContactSort, key: SortKey): ContactSort =>
  current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "cadastro" ? "desc" : "asc" };

// Desempate por id: a ordem é estável entre páginas mesmo com valores iguais.
export const toOrderBy = (sort: ContactSort): Prisma.ContactOrderByWithRelationInput[] => [
  { [SORT_FIELDS[sort.key]]: sort.dir },
  { id: sort.dir },
];

// --- Paginação por cursor na ordem escolhida ---

// Cursor da lista de contatos: [coluna da ordenação, valor dela na linha, id]. Cursor de outra ordenação é ignorado.
export const CONTACT_CURSOR_LENGTH = 3;

type SortableContact = { id: string; name: string; city: string; origin: ContactOrigin; createdAt: Date };

export const contactCursor = (sort: ContactSort) => (c: SortableContact) => {
  const value = sort.key === "cadastro" ? c.createdAt.toISOString() : sort.key === "nome" ? c.name : sort.key === "cidade" ? c.city : c.origin;
  return [sort.key, value, c.id];
};

// Voltando uma página, a consulta anda ao contrário (e o resultado é desvirado depois).
export const keysetOrderBy = (sort: ContactSort, direction: CursorDirection) =>
  toOrderBy(direction === "after" ? sort : { ...sort, dir: sort.dir === "asc" ? "desc" : "asc" });

// "Depois do cursor" na ordem (coluna, id): coluna além do valor, ou mesmo valor e id além. null = cursor inválido.
export const keysetWhere = (sort: ContactSort, cursor: string[] | null, direction: CursorDirection): Prisma.ContactWhereInput | null => {
  if (!cursor || cursor[0] !== sort.key) return null;
  const [, raw, id] = cursor as [string, string, string];
  const forward = (sort.dir === "asc") === (direction === "after");
  const op = forward ? "gt" : "lt";

  if (sort.key === "origem") {
    // Enum não tem > no Prisma: "depois" é a lista dos valores seguintes na ordem do enum (a mesma de ORIGINS).
    const index = ORIGINS.indexOf(raw as ContactOrigin);
    if (index < 0) return null;
    const beyond = forward ? ORIGINS.slice(index + 1) : ORIGINS.slice(0, index);
    return { OR: [{ origin: { in: beyond } }, { origin: raw as ContactOrigin, id: { [op]: id } }] };
  }
  if (sort.key === "cadastro") {
    const at = new Date(raw);
    if (Number.isNaN(at.getTime())) return null;
    return { OR: [{ createdAt: { [op]: at } }, { createdAt: at, id: { [op]: id } }] };
  }
  const field = SORT_FIELDS[sort.key] as "name" | "city";
  return { OR: [{ [field]: { [op]: raw } }, { [field]: raw, id: { [op]: id } }] };
};

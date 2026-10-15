// Paginação por cursor (keyset): a próxima página começa depois da última linha vista ("WHERE (ordem, id) > …"),
// em vez de pular N linhas com OFFSET. O custo por página não cresce com a profundidade e inserções no meio não
// duplicam nem escondem linhas. O cursor é opaco para o cliente e validado na volta (é dado da URL).
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "./pagination";

export type CursorDirection = "after" | "before";
export type CursorRequest = { cursor: string[] | null; direction: CursorDirection; pageSize: number };
export type CursorPage<T> = { items: T[]; pageSize: number; next: string | null; prev: string | null; total: number | null };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const MAX_CURSOR_LENGTH = 512;

export const encodeCursor = (values: string[]) => Buffer.from(JSON.stringify(values), "utf8").toString("base64url");

// Cursor inválido (editado, truncado, de outra ordenação) vale como "primeira página": nunca erro 500.
export const decodeCursor = (raw: string | undefined, length: number): string[] | null => {
  if (!raw || raw.length > MAX_CURSOR_LENGTH || !/^[\w-]+$/.test(raw)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    return Array.isArray(parsed) && parsed.length === length && parsed.every((v) => typeof v === "string" && v.length <= 200)
      ? (parsed as string[])
      : null;
  } catch {
    return null;
  }
};

// ?apos=<cursor> avança; ?antes=<cursor> volta. "length" é quantos valores o cursor desta lista carrega.
export const parseCursorRequest = (
  params: { apos?: string | string[]; antes?: string | string[]; por?: string | string[] },
  length: number,
): CursorRequest => {
  const size = Number.parseInt(first(params.por) ?? "", 10);
  const pageSize = (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE;
  const before = decodeCursor(first(params.antes), length);
  if (before) return { cursor: before, direction: "before", pageSize };
  return { cursor: decodeCursor(first(params.apos), length), direction: "after", pageSize };
};

// Busca pageSize + 1 linhas para saber se existe outra página sem contar a tabela. Voltando ("before"), a
// consulta vem na ordem inversa e é desvirada aqui.
export const cursorPaginate = async <T>(
  req: CursorRequest,
  find: (window: { cursor: string[] | null; direction: CursorDirection; take: number }) => Promise<T[]>,
  cursorOf: (item: T) => string[],
  total: number | null = null,
): Promise<CursorPage<T>> => {
  const rows = await find({ cursor: req.cursor, direction: req.direction, take: req.pageSize + 1 });
  const more = rows.length > req.pageSize;
  const items = rows.slice(0, req.pageSize);
  if (req.direction === "before") items.reverse();
  const edge = (item: T | undefined) => (item ? encodeCursor(cursorOf(item)) : null);
  const hasNext = req.direction === "before" ? true : more;
  const hasPrev = req.direction === "before" ? more : req.cursor !== null;
  return {
    items,
    pageSize: req.pageSize,
    next: hasNext && items.length ? edge(items.at(-1)) : null,
    prev: hasPrev && items.length ? edge(items[0]) : null,
    total,
  };
};

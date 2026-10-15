// Paginação por offset com tamanho de página fechado numa lista: o cliente não consegue pedir
// 1 milhão de linhas por requisição. Página fora do intervalo cai na mais próxima.
export const PAGE_SIZES = [10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;

export type PageRequest = { page: number; pageSize: number };
export type Page<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const parsePageRequest = (params: { page?: string | string[]; por?: string | string[] }): PageRequest => {
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  const size = Number.parseInt(first(params.por) ?? "", 10);
  return {
    page: Number.isFinite(page) && page >= 1 && page <= 100_000 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
};

export const toPage = <T>(items: T[], total: number, req: PageRequest): Page<T> => ({
  items,
  page: req.page,
  pageSize: req.pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / req.pageSize)),
});

export const offsetOf = (req: PageRequest) => (req.page - 1) * req.pageSize;

// Página além da última (link antigo, URL editada) vira a última: nunca uma lista vazia enganosa.
export const clampPage = (req: PageRequest, total: number): PageRequest => {
  const last = Math.max(1, Math.ceil(total / req.pageSize));
  return req.page > last ? { ...req, page: last } : req;
};

// Conta primeiro, ajusta a página e só então busca a fatia (LIMIT/OFFSET no banco).
export const paginate = async <T>(
  req: PageRequest,
  count: () => Promise<number>,
  find: (window: { skip: number; take: number }) => Promise<T[]>,
): Promise<Page<T>> => {
  const total = await count();
  const page = clampPage(req, total);
  const items = total === 0 ? [] : await find({ skip: offsetOf(page), take: page.pageSize });
  return toPage(items, total, page);
};

// Navegação de listas paginadas por cursor: "Anterior" e "Próxima" (sem números de página: o cursor não sabe em
// que página está, e é isso que o deixa barato em qualquer profundidade).
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CursorPage } from "@/lib/cursor";
import { formatNumber } from "@/lib/format";

type Params = Record<string, string | undefined>;

const hrefFor = (basePath: string, params: Params, key: "apos" | "antes", cursor: string) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v && k !== "apos" && k !== "antes") search.set(k, v);
  search.set(key, cursor);
  return `${basePath}?${search.toString()}`;
};

export const CursorPagination = ({
  page,
  basePath,
  params,
  noun = ["item", "itens"],
}: {
  page: CursorPage<unknown>;
  basePath: string;
  params: Params;
  noun?: [string, string];
}) => {
  const link = "inline-flex h-8 items-center gap-1 px-2.5 text-sm";
  const off = "pointer-events-none text-muted opacity-50";
  const on = "text-foreground hover:bg-subtle";

  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-muted">
      <p>{page.total === null ? "Mais recentes primeiro" : `${formatNumber(page.total)} ${page.total === 1 ? noun[0] : noun[1]}`}</p>
      <div className="flex items-center gap-1">
        {page.prev ? (
          <Link href={hrefFor(basePath, params, "antes", page.prev)} className={clsx(link, on)} aria-label="Página anterior">
            <ChevronLeft className="size-4" aria-hidden /> Anterior
          </Link>
        ) : (
          <span className={clsx(link, off)} aria-hidden>
            <ChevronLeft className="size-4" /> Anterior
          </span>
        )}
        {page.next ? (
          <Link href={hrefFor(basePath, params, "apos", page.next)} className={clsx(link, on)} aria-label="Próxima página">
            Próxima <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <span className={clsx(link, off)} aria-hidden>
            Próxima <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
};

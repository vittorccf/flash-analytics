import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Page } from "@/lib/pagination";
import { formatNumber } from "@/lib/format";

type Params = Record<string, string | undefined>;

const hrefFor = (basePath: string, params: Params, page: number) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v && k !== "page") search.set(k, v);
  if (page > 1) search.set("page", String(page));
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
};

// Janela de páginas ao redor da atual (1 … 4 5 [6] 7 8 … 20).
const pageWindow = (current: number, total: number) => {
  const pages = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total));
  return [...pages].sort((a, b) => a - b);
};

export const Pagination = ({ page, basePath, params }: { page: Page<unknown>; basePath: string; params: Params }) => {
  const from = page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1;
  const to = Math.min(page.total, page.page * page.pageSize);
  const pages = pageWindow(page.page, page.totalPages);
  const link = "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm";

  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-muted">
      <p>
        {formatNumber(from)}–{formatNumber(to)} de {formatNumber(page.total)}
      </p>
      <div className="flex items-center gap-1">
        {page.page > 1 ? (
          <Link href={hrefFor(basePath, params, page.page - 1)} className={clsx(link, "hover:bg-subtle")} aria-label="Página anterior">
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
        ) : null}
        {pages.map((p, i) => (
          <span key={p} className="flex items-center gap-1">
            {i > 0 && p - pages[i - 1]! > 1 ? <span aria-hidden>…</span> : null}
            <Link
              href={hrefFor(basePath, params, p)}
              aria-current={p === page.page ? "page" : undefined}
              className={clsx(link, p === page.page ? "bg-primary font-medium text-primary-foreground" : "hover:bg-subtle text-foreground")}
            >
              {p}
            </Link>
          </span>
        ))}
        {page.page < page.totalPages ? (
          <Link href={hrefFor(basePath, params, page.page + 1)} className={clsx(link, "hover:bg-subtle")} aria-label="Próxima página">
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    </nav>
  );
};

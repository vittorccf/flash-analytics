"use client";

// Busca de contatos no topo da tela (atalhos: Ctrl+K ou "/"). Combobox acessível: setas navegam, Enter abre,
// Esc limpa. A busca roda no servidor, só nos contatos que a pessoa pode ver.
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Search } from "lucide-react";
import { quickSearchAction } from "@/app/(app)/contatos/actions";
import { formatPhone } from "@/lib/phone";
import { ContactAvatar } from "./avatar";

type Result = Awaited<ReturnType<typeof quickSearchAction>>[number];

export const GlobalSearch = () => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef("");
  const id = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const search = (value: string) => {
    setQuery(value);
    setActive(-1);
    clearTimeout(timer.current);
    latest.current = value;
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    // Espera a pessoa parar de digitar (250 ms) e descarta respostas de buscas antigas.
    timer.current = setTimeout(() => {
      startTransition(async () => {
        const found = await quickSearchAction(value).catch(() => []);
        if (latest.current === value) {
          setResults(found);
          setOpen(true);
        }
      });
    }, 250);
  };

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && results[active]) go(`/contatos/${results[active]!.id}`);
      else if (query.trim()) go(`/contatos?q=${encodeURIComponent(query.trim())}`);
    } else if (e.key === "Escape") {
      setOpen(false);
      if (!open) search("");
    }
  };

  const showList = open && query.trim().length >= 2;

  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Buscar contato"
        aria-expanded={showList}
        aria-controls={`${id}-list`}
        aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => search(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar contato…  Ctrl+K"
        maxLength={100}
        className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-foreground placeholder:text-muted focus:border-ring focus:outline-none"
      />
      {showList ? (
        <ul id={`${id}-list`} role="listbox" className="absolute right-0 z-40 mt-1 w-80 overflow-hidden rounded-lg border border-border bg-surface py-1 elevation-3">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">{pending ? "Buscando…" : "Nenhum contato encontrado."}</li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.id}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(`/contatos/${r.id}`);
                }}
                onMouseEnter={() => setActive(i)}
                className={clsx("flex cursor-pointer items-center gap-3 px-3 py-2 text-sm", i === active && "bg-subtle")}
              >
                <ContactAvatar id={r.id} name={r.name} photoVersion={r.photo?.updatedAt} size={32} />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{r.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {formatPhone(r.phone)} · {r.city}/{r.state}
                    {r.email ? ` · ${r.email}` : ""}
                  </span>
                </span>
              </li>
            ))
          )}
          <li role="presentation" className="border-t border-border">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                go(`/contatos?q=${encodeURIComponent(query.trim())}`);
              }}
              className="w-full px-3 py-2 text-left text-sm font-medium text-primary hover:bg-subtle"
            >
              Ver todos os resultados para “{query.trim()}”
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
};

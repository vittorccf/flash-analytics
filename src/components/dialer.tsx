"use client";

// Discador: teclado numérico em modal para ligar, mandar SMS ou WhatsApp. Enquanto a pessoa digita (número ou
// nome), sugere contatos em tempo real. Usa o <dialog> nativo: prende o foco, fecha com Esc e devolve o foco.
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { ArrowUpRight, Copy, Delete, MessageSquareText, Phone, X } from "lucide-react";
import { quickSearchAction } from "@/app/(app)/contatos/actions";
import { WhatsappIcon } from "./icons";
import { ContactAvatar } from "./avatar";
import { whatsappAvailability } from "@/lib/contact-channels";
import { formatPhone } from "@/lib/phone";

const KEYS = [
  ["1", ""], ["2", "ABC"], ["3", "DEF"],
  ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
  ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
  ["*", ""], ["0", "+"], ["#", ""],
] as const;

type Match = Awaited<ReturnType<typeof quickSearchAction>>[number];

const hasLetters = (v: string) => /\p{L}/u.test(v);

// Número brasileiro com DDD (10/11 dígitos) vira +55; qualquer outro vai como digitado (ramal, internacional…).
const toDialable = (value: string) => {
  const raw = value.replace(/[^\d+*#]/g, "");
  return /^\d{10,11}$/.test(raw) ? `+55${raw}` : raw;
};

// Destaca no texto o trecho que bate com a busca (dígitos podem ter máscara no meio: "(11) 98…").
const Highlight = ({ text, query }: { text: string; query: string }) => {
  const digits = query.replace(/\D/g, "");
  const pattern = hasLetters(query)
    ? new RegExp(query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    : digits.length >= 2
      ? new RegExp(digits.split("").join("\\D*"))
      : null;
  const m = pattern?.exec(text);
  if (!m) return <>{text}</>;
  return (
    <>
      {text.slice(0, m.index)}
      <mark className="rounded-sm bg-primary-soft px-0.5 text-primary-strong">{m[0]}</mark>
      {text.slice(m.index + m[0].length)}
    </>
  );
};

export const Dialer = () => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [copied, setCopied] = useState(false);
  const [searching, startSearch] = useTransition();
  const latest = useRef("");

  const isName = hasLetters(value);
  const digits = isName ? "" : value.replace(/\D/g, "");
  const dialable = toDialable(value);
  const isBr = !isName && /^\d{10,11}$/.test(digits) && !value.trim().startsWith("+");
  const canCall = !isName && digits.length >= 3;
  const wa = isBr ? whatsappAvailability(digits, null) : { available: false, reason: "WhatsApp: número brasileiro com DDD" };
  const query = isName ? value.trim() : digits;
  const showMatches = query.length >= 2;

  // Sugestões em tempo real: a cada tecla, com uma espera curta para não disparar uma busca por caractere.
  useEffect(() => {
    latest.current = query;
    if (query.length < 2) return;
    const handle = setTimeout(() => {
      startSearch(async () => {
        const found = await quickSearchAction(query).catch(() => []);
        if (latest.current === query) setMatches(found);
      });
    }, 120);
    return () => clearTimeout(handle);
  }, [query]);

  const press = (key: string) => setValue((v) => (hasLetters(v) ? key : (v + key).slice(0, 20)));
  const backspace = () => setValue((v) => v.slice(0, -1));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (/^[\d*#+]$/.test(e.key)) press(e.key);
    else if (e.key === "Backspace") backspace();
  };

  const copy = async () => {
    await navigator.clipboard.writeText(isBr ? formatPhone(digits) : value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const close = () => dialog.current?.close();
  const secondary =
    "flex flex-col items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-muted-strong transition-colors hover:bg-subtle hover:text-foreground disabled:pointer-events-none disabled:opacity-35";

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-label="Abrir discador"
        title="Discador"
        className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-muted-strong transition-colors hover:bg-subtle hover:text-foreground"
      >
        <Phone className="size-4" aria-hidden />
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="dialer-title"
        onKeyDown={onKeyDown}
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] overflow-hidden p-0 text-foreground modal-depth backdrop:bg-ink-950/55 backdrop:backdrop-blur-sm"
      >
        <div aria-hidden className="h-1 [background:var(--gradient-brand)]" />
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="dialer-title" className="text-lg font-semibold tracking-tight">
              Discador
            </h2>
            <button type="button" onClick={close} aria-label="Fechar discador" className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-foreground">
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <label htmlFor="dialer-number" className="sr-only">
            Número ou nome do contato
          </label>
          <div className="relative">
            <input
              id="dialer-number"
              value={isBr ? formatPhone(digits) : value}
              onChange={(e) => setValue(e.target.value.slice(0, 40))}
              autoComplete="off"
              placeholder="Número ou nome"
              className="h-16 w-full rounded-2xl bg-subtle px-12 text-center text-2xl font-semibold tracking-wide tabular-nums placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {value ? (
              <button
                type="button"
                onClick={backspace}
                aria-label="Apagar último caractere"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground"
              >
                <Delete className="size-5" aria-hidden />
              </button>
            ) : null}
          </div>

          <div className="mt-2 min-h-24" aria-live="polite">
            {showMatches ? (
              matches.length ? (
                <ul aria-label="Contatos sugeridos" className="space-y-1">
                  {matches.slice(0, 3).map((m) => (
                    <li key={m.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setValue(m.phone)}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-subtle"
                      >
                        <ContactAvatar id={m.id} name={m.name} photoVersion={m.photo?.updatedAt} size={28} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          <Highlight text={m.name} query={value} />
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted">
                          <Highlight text={formatPhone(m.phone)} query={value} />
                        </span>
                      </button>
                      <Link
                        href={`/contatos/${m.id}`}
                        onClick={close}
                        aria-label={`Abrir ${m.name}`}
                        title="Abrir contato"
                        className="rounded-lg p-2 text-muted hover:bg-subtle hover:text-foreground"
                      >
                        <ArrowUpRight className="size-4" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-2 text-sm text-muted">{searching ? "Procurando…" : "Nenhum contato com isso."}</p>
              )
            ) : (
              <p className="px-3 py-2 text-sm text-muted">Digite um número ou nome: os contatos aparecem aqui.</p>
            )}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-3" role="group" aria-label="Teclado">
            {KEYS.map(([key, letters]) => (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                aria-label={key}
                className="flex h-16 flex-col items-center justify-center rounded-2xl bg-subtle text-2xl font-medium transition-colors hover:bg-border active:scale-95 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {key}
                <span className="h-3 text-[0.62rem] font-semibold tracking-[0.2em] text-muted">{letters}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-5 items-center">
            <button type="button" onClick={copy} disabled={!canCall} className={secondary} aria-label="Copiar número">
              <Copy className="size-5" aria-hidden />
              {copied ? "Copiado" : "Copiar"}
            </button>
            <a href={canCall ? `sms:${dialable}` : undefined} aria-disabled={!canCall} className={clsx(secondary, !canCall && "pointer-events-none opacity-35")}>
              <MessageSquareText className="size-5" aria-hidden />
              SMS
            </a>
            <a
              href={canCall ? `tel:${dialable}` : undefined}
              aria-disabled={!canCall}
              aria-label="Ligar"
              className={clsx(
                "mx-auto inline-flex size-16 items-center justify-center rounded-full bg-success text-primary-foreground elevation-3 transition hover:brightness-110 active:scale-95",
                !canCall && "pointer-events-none opacity-35",
              )}
            >
              <Phone className="size-7" aria-hidden />
            </a>
            <a
              href={wa.available ? `https://wa.me/55${digits}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!wa.available}
              title={wa.reason}
              className={clsx(secondary, !wa.available && "pointer-events-none opacity-35")}
            >
              <WhatsappIcon className="size-5 text-whatsapp" aria-hidden />
              WhatsApp
            </a>
            <button type="button" onClick={() => setValue("")} disabled={!value} className={secondary} aria-label="Limpar">
              <X className="size-5" aria-hidden />
              Limpar
            </button>
          </div>
          <p className="mt-4 text-center text-xs text-muted">O sistema pergunta qual app usar para ligar (celular, Teams, Skype…).</p>
        </div>
      </dialog>
    </>
  );
};

"use client";

// Perfil no canto superior direito: nome, papel e e-mail, atalho para "Minha conta" e "Sair".
// Fecha com Esc (devolvendo o foco ao botão) ou clique fora.
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { Avatar } from "./avatar";

export const UserMenu = ({
  name,
  email,
  roleLabel,
  showAccount,
  logoutAction,
}: {
  name: string;
  email: string;
  roleLabel: string;
  showAccount: boolean;
  logoutAction: () => Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-subtle";

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Conta de ${name}`}
        className="flex h-9 items-center gap-2 border border-border bg-surface pl-1 pr-2 text-sm text-foreground transition-colors hover:bg-subtle"
      >
        <Avatar name={name} size={28} />
        <span className="hidden max-w-36 truncate font-medium sm:block">{name}</span>
        <ChevronDown className="size-4 text-muted" aria-hidden />
      </button>
      {open ? (
        <div id={id} className="absolute right-0 z-40 mt-1 w-64 border border-border bg-surface py-1 elevation-3">
          <div className="border-b border-border px-3 pb-2 pt-1.5">
            <p className="truncate text-sm font-medium text-foreground">{name}</p>
            <p className="truncate text-xs text-muted">
              {roleLabel} · {email}
            </p>
          </div>
          {showAccount ? (
            <Link href="/conta" className={item} onClick={() => setOpen(false)}>
              <UserRound className="size-4 text-muted" aria-hidden /> Minha conta
            </Link>
          ) : null}
          <form action={logoutAction}>
            <button type="submit" className={item}>
              <LogOut className="size-4 text-muted" aria-hidden /> Sair
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
};

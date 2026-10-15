"use client";

// Menu de ações (botão + lista). Acessível: abre com Enter/Espaço/seta, navega com setas, fecha com Esc
// (devolvendo o foco ao botão) ou clique fora. Posição fixa calculada do botão: não é cortado pela rolagem
// horizontal da tabela.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";

export type ActionItem = {
  label: string;
  icon?: ReactNode;
  href?: string;
  external?: boolean; // abre em nova aba (sites); tel:/sms:/mailto: ficam na mesma
  copy?: string; // copia o texto para a área de transferência
  onSelect?: () => void; // ação no próprio navegador (ex.: compartilhar do celular)
  download?: boolean;
};

const MENU_WIDTH = 240;

export const ActionMenu = ({
  trigger,
  label,
  items,
  hint,
  disabled,
  disabledReason,
  triggerClassName,
}: {
  trigger: ReactNode;
  label: string;
  items: ActionItem[];
  hint?: string;
  disabled?: boolean;
  disabledReason?: string;
  triggerClassName?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [copied, setCopied] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const items$ = () => [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];

  const close = (restoreFocus = true) => {
    setOpen(false);
    setCopied(null);
    if (restoreFocus) buttonRef.current?.focus();
  };

  const openMenu = () => {
    const rect = buttonRef.current!.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8)) });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    items$()[0]?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) close(false);
    };
    const onScroll = () => close(false);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const list = items$();
    const index = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      list[(index + (e.key === "ArrowDown" ? 1 : list.length - 1)) % list.length]?.focus();
    } else if (e.key === "Tab") close(false);
  };

  const onCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => close(), 900);
    } catch {
      close();
    }
  };

  if (disabled) {
    return (
      <span
        role="img"
        aria-label={`${label}: indisponível. ${disabledReason ?? ""}`}
        title={disabledReason}
        className={clsx(triggerClassName, "cursor-not-allowed opacity-35")}
      >
        {trigger}
      </span>
    );
  }

  const itemClass = "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground hover:bg-subtle focus:bg-subtle focus:outline-none";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            openMenu();
          }
        }}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
          className="fixed z-50 overflow-hidden rounded-lg border border-border bg-surface py-1 elevation-3"
        >
          {hint ? <p className="border-b border-border px-3 pb-2 pt-1 text-xs text-muted">{hint}</p> : null}
          {items.map((item) =>
            item.onSelect ? (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={itemClass}
                onClick={() => {
                  item.onSelect!();
                  close(false);
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ) : item.copy !== undefined ? (
              <button key={item.label} type="button" role="menuitem" tabIndex={-1} className={itemClass} onClick={() => onCopy(item.copy!)}>
                {copied === item.copy ? <Check className="size-4 text-success-strong" aria-hidden /> : item.icon}
                {copied === item.copy ? "Copiado!" : item.label}
              </button>
            ) : (
              <a
                key={item.label}
                role="menuitem"
                tabIndex={-1}
                href={item.href}
                className={itemClass}
                onClick={() => close(false)}
                {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                {...(item.download ? { download: "" } : {})}
              >
                {item.icon}
                {item.label}
              </a>
            ),
          )}
        </div>
      ) : null}
    </>
  );
};

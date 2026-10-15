"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Activity, Bell, BookUser, Inbox, KeyRound, LayoutDashboard, CircleHelp, LifeBuoy, Palette, UserPlus, Users, Wrench } from "lucide-react";
import { openSupport } from "@/components/support-widget";

type Item = { href: string; label: string; icon: typeof Bell; count?: number; exact?: boolean };

export const Nav = ({
  role,
  restricted,
  counts,
  canCreate = true,
}: {
  role: "ADMIN" | "OPERATOR";
  canCreate?: boolean;
  restricted: boolean;
  counts: { pending: number; unread: number; support?: number };
}) => {
  const pathname = usePathname();

  const items: Item[] = restricted
    ? [{ href: "/conta/senha", label: "Trocar senha", icon: KeyRound }]
    : role === "ADMIN"
      ? [
          { href: "/admin", label: "Painel", icon: LayoutDashboard, exact: true },
          { href: "/contatos", label: "Contatos", icon: BookUser },
          { href: "/admin/solicitacoes", label: "Solicitações", icon: Inbox, count: counts.pending },
          { href: "/admin/usuarios", label: "Usuários", icon: Users },
          { href: "/admin/atividade", label: "Atividade", icon: Activity },
          { href: "/notificacoes", label: "Notificações", icon: Bell, count: counts.unread },
          { href: "/conta", label: "Minha conta", icon: KeyRound },
          { href: "/admin/suporte", label: "Suporte", icon: LifeBuoy, count: counts.support },
          { href: "/admin/manutencao", label: "Manutenção", icon: Wrench },
          { href: "/design-system", label: "Design system", icon: Palette },
        ]
      : [
          { href: "/contatos", label: "Meus contatos", icon: BookUser, exact: true },
          ...(canCreate ? [{ href: "/contatos/novo", label: "Novo contato", icon: UserPlus }] : []),
          { href: "/conta", label: "Minha conta", icon: KeyRound },
        ];

  return (
    <nav aria-label="Principal" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              // Item ativo: barra vermelha à esquerda (o "chevron" da marca), não fundo vermelho.
              active
                ? "bg-sidebar-accent text-sidebar-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:[background:var(--gradient-brand)]"
                : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
          >
            <Icon className={clsx("size-4", active && "text-brand-400")} aria-hidden />
            <span className="flex-1">{item.label}</span>
            {item.count ? (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground tabular-nums" aria-label={`${item.count} novos`}>
                {item.count > 99 ? "99+" : item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={openSupport}
        className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground md:mt-2"
      >
        <CircleHelp className="size-4" aria-hidden />
        <span className="flex-1">Ajuda e suporte</span>
      </button>
    </nav>
  );
};

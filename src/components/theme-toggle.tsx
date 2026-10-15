"use client";

// Escolha de tema: muda na hora (atributo no <html>) e guarda no cookie para as próximas páginas.
import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { ActionMenu } from "./action-menu";
import { THEME_COOKIE, THEME_LABELS, type Theme } from "@/lib/theme";

const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

// Efeito fora do componente: aplica no <html> e guarda no cookie.
const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
};

export const ThemeToggle = ({ initial }: { initial: Theme }) => {
  const [theme, setTheme] = useState<Theme>(initial);
  const Icon = ICONS[theme];

  const choose = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  return (
    <ActionMenu
      label={`Tema: ${THEME_LABELS[theme]}`}
      trigger={<Icon className="size-4" aria-hidden />}
      triggerClassName="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-muted-strong hover:bg-subtle hover:text-foreground"
      items={(Object.keys(THEME_LABELS) as Theme[]).map((t) => {
        const ItemIcon = ICONS[t];
        return {
          label: `${THEME_LABELS[t]}${t === theme ? " ✓" : ""}`,
          onSelect: () => choose(t),
          icon: <ItemIcon className="size-4 text-muted" aria-hidden />,
        };
      })}
    />
  );
};

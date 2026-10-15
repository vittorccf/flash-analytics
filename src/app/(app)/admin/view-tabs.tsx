"use client";

// Alterna entre visões do mesmo dado (ex.: mapa × gráfico). Abas acessíveis: setas esquerda/direita trocam,
// e só a aba ativa entra na ordem do Tab.
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { chipClass } from "@/components/ui";

export type ViewTab = { key: string; label: string; content: ReactNode };

export const ViewTabs = ({ tabs, label }: { tabs: ViewTab[]; label: string }) => {
  const [active, setActive] = useState(tabs[0]!.key);
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const next = (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    setActive(tabs[next]!.key);
    buttons.current[next]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className="mb-4 flex gap-2">
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${tab.key}`}
            aria-selected={active === tab.key}
            aria-controls={`${id}-panel-${tab.key}`}
            tabIndex={active === tab.key ? 0 : -1}
            onClick={() => setActive(tab.key)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={chipClass(active === tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`${id}-panel-${tab.key}`}
          aria-labelledby={`${id}-tab-${tab.key}`}
          hidden={active !== tab.key}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
};

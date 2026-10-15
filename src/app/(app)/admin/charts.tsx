"use client";

import { useId, useSyncExternalStore, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Degradê da marca nas barras (cor viva na ponta, mais escura na base), igual nos dois temas.
const BrandGradient = ({ id, vertical }: { id: string; vertical: boolean }) => (
  <defs>
    {/* Vertical: viva no topo, escura na base. Horizontal: escura na base (esquerda), viva na ponta. */}
    <linearGradient id={id} x1="0" y1="0" x2={vertical ? "0" : "1"} y2={vertical ? "1" : "0"}>
      <stop offset="0%" className={vertical ? "[stop-color:var(--color-chart-1)]" : "[stop-color:var(--color-brand-800)]"} />
      <stop offset="100%" className={vertical ? "[stop-color:var(--color-brand-800)]" : "[stop-color:var(--color-chart-1)]"} />
    </linearGradient>
  </defs>
);

// Cores só pelos tokens --color-chart-* de globals.css (fill/stroke SVG aceitam var() nos navegadores atuais).
const PALETTE = [1, 2, 3, 4, 5, 6].map((n) => `var(--color-chart-${n})`);
const AXIS = { fontSize: 12, fill: "var(--color-chart-axis)" };

type Datum = { label: string; count: number };

// O Recharts escreve style= nos elementos. Renderizado só no navegador, o React aplica esses estilos via CSSOM,
// que a CSP sem 'unsafe-inline' permite; vindo no HTML do servidor, seriam bloqueados.
const noop = () => () => {};
const ClientOnly = ({ children, placeholder }: { children: ReactNode; placeholder: string }) =>
  useSyncExternalStore(noop, () => true, () => false) ? children : <div aria-hidden className={placeholder} />;

const tooltipProps = {
  cursor: { fill: "var(--color-subtle)" },
  // Fundo e texto pelos tokens: o tooltip acompanha o tema claro/escuro.
  contentStyle: { borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 13, fontFamily: "var(--font-sans)", background: "var(--color-surface)", color: "var(--color-foreground)" },
  labelStyle: { color: "var(--color-foreground)" },
  itemStyle: { color: "var(--color-foreground)" },
  formatter: (value: unknown) => [String(value), "Contatos"] as [string, string],
};

export const DailyChart = ({ data }: { data: Datum[] }) => {
  const id = useId().replace(/:/g, "");
  return (
  <ClientOnly placeholder="h-60">
  <ResponsiveContainer width="100%" height={240}>
    <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
      <BrandGradient id={id} vertical />
      <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
      <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
      <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
      <Tooltip {...tooltipProps} />
      <Bar dataKey="count" fill={`url(#${id})`} radius={[6, 6, 0, 0]} maxBarSize={32} isAnimationActive={false} />
    </BarChart>
  </ResponsiveContainer>
  </ClientOnly>
  );
};

export const HorizontalBars = ({ data, colorful = false, labelWidth = 120 }: { data: Datum[]; colorful?: boolean; labelWidth?: number }) => {
  const id = useId().replace(/:/g, "");
  return (
  <ClientOnly placeholder="h-40">
  <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
    <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
      <BrandGradient id={id} vertical={false} />
      <XAxis type="number" allowDecimals={false} hide />
      <YAxis type="category" dataKey="label" tick={AXIS} tickLine={false} axisLine={false} width={labelWidth} />
      <Tooltip {...tooltipProps} />
      <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={20} isAnimationActive={false} label={{ position: "right", fontSize: 12, fill: "var(--color-muted-strong)" }}>
        {data.map((d, i) => (
          <Cell key={d.label} fill={colorful ? PALETTE[i % PALETTE.length] : `url(#${id})`} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
  </ClientOnly>
  );
};

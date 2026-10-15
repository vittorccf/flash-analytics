// Identidade Flash Analytics / Flash Contacts. Único lugar que desenha o logo (o favicon em app/icon.svg é a cópia estática).
import { useId } from "react";
import clsx from "clsx";

// Três chevrons crescentes: velocidade e avanço. Desenhado em grade 48×40 a partir do logo oficial.
const CHEVRONS = [
  "M3 11h5l8 9-8 9H3l8-9z",
  "M12 6h6l11 14-11 14h-6l11-14z",
  "M23 1h7l16 19-16 19h-7l16-19z",
];

export const BrandMark = ({ className, title }: { className?: string; title?: string }) => {
  // Ids únicos: o logo aparece mais de uma vez na página (sidebar + login).
  const id = useId();
  return (
    <svg
      viewBox="0 0 48 40"
      className={clsx("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="var(--color-brand-500)" />
          <stop offset="0.55" stopColor="var(--color-brand-700)" />
          <stop offset="1" stopColor="var(--color-brand-900)" />
        </linearGradient>
      </defs>
      {CHEVRONS.map((d, i) => (
        <path key={d} d={d} fill={`url(#${id}-fill)`} opacity={0.72 + i * 0.14} />
      ))}
    </svg>
  );
};

// Símbolo + nome do produto em caixa alta espaçada, como no logotipo da Flash Analytics.
export const Logo = ({
  tone = "light",
  endorsed = false,
  className,
}: {
  tone?: "light" | "dark";
  endorsed?: boolean;
  className?: string;
}) => (
  <span className={clsx("inline-flex items-center gap-3", className)}>
    <BrandMark className="h-7 w-auto" />
    <span className="flex flex-col leading-none">
      <span className={clsx("text-[0.8rem] font-semibold uppercase tracking-[0.28em]", tone === "dark" ? "text-sidebar-foreground" : "text-foreground")}>
        Flash Contacts
      </span>
      {endorsed ? (
        <span className={clsx("mt-1 text-[0.65rem] uppercase tracking-[0.2em]", tone === "dark" ? "text-sidebar-muted" : "text-muted")}>
          by Flash Analytics
        </span>
      ) : null}
    </span>
  </span>
);

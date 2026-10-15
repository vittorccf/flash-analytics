// Componentes base do design system (Tailwind + tokens de globals.css). Catálogo vivo em /design-system.
import clsx from "clsx";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "inverse";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground elevation-1 hover:bg-primary-hover",
  secondary: "border border-border bg-surface text-foreground elevation-1 hover:bg-subtle",
  // Contornado de propósito: a primária já é vermelha, o perigo se distingue pela forma (e pelo verbo do rótulo).
  danger: "border border-danger/40 bg-surface text-danger-strong hover:border-danger hover:bg-danger-soft",
  ghost: "text-muted-strong hover:bg-subtle hover:text-foreground",
  // Sobre superfícies escuras (sidebar, painel do login).
  inverse: "border border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent",
};

export const buttonClass = (variant: ButtonVariant = "primary", size: "sm" | "md" = "md") =>
  clsx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-[-0.005em] transition-[color,background-color,border-color,box-shadow,transform] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60",
    size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
    buttonVariants[variant],
  );

export const Button = ({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" }) => (
  <button type={type} className={clsx(buttonClass(variant, size), className)} {...props} />
);

const fieldClass =
  "block w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground field-depth placeholder:text-muted focus:border-ink-400 aria-[invalid=true]:border-danger";

export const Input = ({ className, ...props }: ComponentProps<"input">) => (
  <input className={clsx(fieldClass, "h-10", className)} {...props} />
);

export const Select = ({ className, ...props }: ComponentProps<"select">) => (
  <select className={clsx(fieldClass, "h-10", className)} {...props} />
);

export const Textarea = ({ className, ...props }: ComponentProps<"textarea">) => (
  <textarea className={clsx(fieldClass, "py-2", className)} {...props} />
);

// Rótulo + controle + ajuda/erro, já ligados por id (acessibilidade).
export const Field = ({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-sm font-medium text-foreground">
      {label}
    </label>
    {children}
    {error ? (
      <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-danger-strong">
        <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {error}
      </p>
    ) : hint ? (
      <p id={`${id}-hint`} className="text-xs text-muted">
        {hint}
      </p>
    ) : null}
  </div>
);

// Props de acessibilidade para o controle dentro de <Field>.
export const fieldA11y = (id: string, error?: string, hint?: string) => ({
  id,
  name: id,
  "aria-invalid": error ? true : undefined,
  "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
});

export const Card = ({ className, ...props }: ComponentProps<"section">) => (
  <section className={clsx("rounded-2xl border border-border/80 bg-surface elevation-1", className)} {...props} />
);

export const CardHeader = ({ title, description, action }: { title: string; description?: string; action?: ReactNode }) => (
  <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
    <div>
      <h2 className="text-[0.95rem] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
    </div>
    {action}
  </div>
);

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";
const toneClass: Record<Tone, string> = {
  neutral: "bg-subtle text-muted-strong",
  // Destaque informativo em grafite: vermelho claro num badge seria lido como problema.
  primary: "bg-foreground text-surface",
  success: "bg-success-soft text-success-strong",
  warning: "bg-warning-soft text-warning-strong",
  danger: "bg-danger-soft text-danger-strong",
};

export const Badge = ({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) => (
  <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium", toneClass[tone])}>{children}</span>
);

type AlertTone = Exclude<Tone, "neutral" | "primary">;
const alertIcon = { danger: CircleAlert, warning: TriangleAlert, success: CircleCheck } satisfies Record<AlertTone, unknown>;

// Ícone por tom: o erro não pode depender só do vermelho, que também é a cor da marca.
export const Alert = ({ tone = "danger", children }: { tone?: AlertTone; children: ReactNode }) => {
  const Icon = alertIcon[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={clsx("flex gap-2 rounded-lg px-3 py-2.5 text-sm", toneClass[tone])}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
};

// Filtro em formato de pílula (ex.: grupos da atividade). Use com <Link aria-current>.
export const chipClass = (active: boolean) =>
  clsx(
    "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
    active ? "border-foreground bg-foreground text-surface" : "border-border bg-surface text-muted-strong hover:bg-subtle hover:text-foreground",
  );

export const PageHeader = ({ title, description, action }: { title: string; description?: string; action?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 className="text-[1.75rem] font-semibold leading-tight text-foreground">{title}</h1>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
    </div>
    {action}
  </div>
);

export const EmptyState = ({ title, description, action }: { title: string; description?: string; action?: ReactNode }) => (
  <div className="px-6 py-14 text-center">
    <p className="font-medium text-foreground">{title}</p>
    {description ? <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p> : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);

export const Table = ({ children, label }: { children: ReactNode; label: string }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-sm" aria-label={label}>
      {children}
    </table>
  </div>
);

export const Th = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <th scope="col" className={clsx("border-b border-border bg-subtle/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted", className)}>
    {children}
  </th>
);

export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={clsx("border-b border-border px-4 py-3 align-top", className)}>{children}</td>
);

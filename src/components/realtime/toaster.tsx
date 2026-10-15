"use client";

import Link from "next/link";
import { Bell, X } from "lucide-react";

export type Toast = { id: string; title: string; body: string; href?: string };

// Região aria-live: leitores de tela anunciam a notificação sem roubar o foco.
export const Toaster = ({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) => (
  <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
    {toasts.map((t) => (
      <div
        key={t.id}
        role="status"
        className="pointer-events-auto flex gap-3 rounded-xl border border-border bg-surface p-4 elevation-3 [animation:toast-in_.2s_ease-out]"
      >
        <Bell className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{t.title}</p>
          <p className="mt-0.5 text-sm text-muted-strong">{t.body}</p>
          {t.href ? (
            <Link href={t.href} className="mt-1 inline-block text-sm font-medium text-primary hover:underline" onClick={() => onDismiss(t.id)}>
              Ver
            </Link>
          ) : null}
        </div>
        <button type="button" onClick={() => onDismiss(t.id)} className="self-start p-0.5 text-muted hover:text-foreground" aria-label="Fechar notificação">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    ))}
  </div>
);

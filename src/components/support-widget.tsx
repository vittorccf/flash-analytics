"use client";

// Botão flutuante de suporte (canto inferior direito). Pode ser fechado (fica fechado neste navegador até
// reabrir pelo link "Ajuda e suporte"). O chamado é gravado; depois a pessoa confirma o envio no WhatsApp.
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { CircleCheck, LifeBuoy, Mail, X } from "lucide-react";
import { sendSupportAction, type SupportState } from "@/app/support-actions";
import { SUPPORT, SUPPORT_PHONE_LABEL, SUPPORT_TYPES } from "@/lib/support";
import { WhatsappIcon } from "./icons";
import { countAttempts, type WithAttempt } from "@/lib/form-attempt";
import { Alert, Button, Field, Input, Select, Textarea, buttonClass, fieldA11y } from "./ui";

const HIDDEN_KEY = "flash_support_hidden";
const OPEN_EVENT = "flash:support-open";

// Estado "escondido" vem do localStorage; useSyncExternalStore evita diferença entre servidor e navegador.
const listeners = new Set<() => void>();
const hiddenStore = {
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get: () => localStorage.getItem(HIDDEN_KEY) === "1",
  set: (hidden: boolean) => {
    if (hidden) localStorage.setItem(HIDDEN_KEY, "1");
    else localStorage.removeItem(HIDDEN_KEY);
    listeners.forEach((fn) => fn());
  },
};

// Outros pontos da tela (ex.: "Ajuda e suporte" no menu) reabrem o painel.
export const openSupport = () => window.dispatchEvent(new Event(OPEN_EVENT));

export const SupportWidget = ({ signedIn }: { signedIn: boolean }) => {
  const hidden = useSyncExternalStore(hiddenStore.subscribe, hiddenStore.get, () => true);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<WithAttempt<SupportState>, FormData>(countAttempts(sendSupportAction), {});
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    const onOpen = () => {
      hiddenStore.set(false);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>("select, textarea, a, button")?.focus();
  }, [open]);

  if (hidden && !open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-labelledby={`${id}-title`}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          className="max-h-[calc(100dvh-7rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain modal-depth"
        >
          <div className="relative px-5 pb-4 pt-5 text-on-brand [background:var(--gradient-brand-strong)]">
            <p id={`${id}-title`} className="text-base font-semibold">
              Fale com o suporte
            </p>
            <p className="mt-0.5 text-sm text-on-brand/85">Respondemos pelo WhatsApp ou e-mail.</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar suporte"
              className="absolute right-3 top-3 rounded-lg p-1 text-on-brand/85 hover:bg-on-brand/15 hover:text-on-brand"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          {state.sent ? (
            <div className="space-y-4 p-5 text-sm" role="status">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <CircleCheck className="size-5 text-success" aria-hidden /> Chamado registrado (protocolo {state.sent.protocol})
              </p>
              <p className="text-muted-strong">Para agilizar, envie também pelo WhatsApp: a mensagem já vai pronta.</p>
              <a href={state.sent.whatsapp} target="_blank" rel="noopener noreferrer" className={`${buttonClass()} w-full`}>
                <WhatsappIcon className="size-4" aria-hidden /> Enviar no WhatsApp
              </a>
              <a href={state.sent.email} className={`${buttonClass("secondary")} w-full`}>
                <Mail className="size-4" aria-hidden /> Enviar por e-mail
              </a>
            </div>
          ) : (
            <form key={state.attempt ?? 0} action={action} className="space-y-3 p-5" noValidate>
              {state.error ? <Alert>{state.error}</Alert> : null}
              <input type="hidden" name="page" value={pathname} />
              <Field id={`${id}-type`} label="Tipo de problema">
                <Select {...fieldA11y(`${id}-type`)} name="type" defaultValue="" required>
                  <option value="" disabled>
                    Selecione
                  </option>
                  {Object.entries(SUPPORT_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id={`${id}-message`} label="Mensagem">
                <Textarea {...fieldA11y(`${id}-message`)} name="message" rows={4} maxLength={2000} required placeholder="O que aconteceu? Em que tela?" />
              </Field>
              {signedIn ? null : (
                <>
                  <Field id={`${id}-name`} label="Seu nome">
                    <Input {...fieldA11y(`${id}-name`)} name="name" maxLength={120} autoComplete="name" />
                  </Field>
                  <Field id={`${id}-reply`} label="E-mail ou telefone para retorno">
                    <Input {...fieldA11y(`${id}-reply`)} name="replyTo" maxLength={254} required />
                  </Field>
                </>
              )}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Enviando…" : "Enviar"}
              </Button>
              <p className="text-center text-xs text-muted">
                Ou direto:{" "}
                <a href={`https://wa.me/55${SUPPORT.whatsapp}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                  {SUPPORT_PHONE_LABEL}
                </a>{" "}
                ·{" "}
                <a href={`mailto:${SUPPORT.email}`} className="font-medium text-primary hover:underline">
                  {SUPPORT.email}
                </a>
              </p>
            </form>
          )}
        </div>
      ) : null}

      {!open ? (
        <div className="group relative">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Falar com o suporte"
            title="Falar com o suporte"
            className="inline-flex size-14 items-center justify-center rounded-full text-on-brand elevation-4 ring-4 ring-surface transition hover:scale-105 [background:var(--gradient-brand)]"
          >
            <LifeBuoy className="size-6" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => hiddenStore.set(true)}
            aria-label="Esconder botão de suporte"
            title="Esconder (reabra em Ajuda e suporte)"
            className="absolute -left-1 -top-1 inline-flex size-6 items-center justify-center rounded-full border border-border bg-surface text-muted elevation-1 hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
};

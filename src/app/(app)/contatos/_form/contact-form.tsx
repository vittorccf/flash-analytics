"use client";

// Formulário de contato, o mesmo para cadastrar e editar (a action e os valores iniciais mudam).
import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, Field, Input, Select, Textarea, buttonClass, fieldA11y } from "@/components/ui";
import { formatPhone } from "@/lib/phone";
import { ORIGIN_LABELS, ORIGINS } from "@/lib/labels";
import type { ContactFormState } from "./actions";
import { AddressFields } from "./address-fields";
import { countAttempts, type WithAttempt } from "@/lib/form-attempt";

type FormAction = (prev: ContactFormState, formData: FormData) => Promise<ContactFormState>;

export const ContactForm = ({
  action: submit,
  initial = {},
  submitLabel = "Salvar contato",
  cancelHref = "/contatos",
}: {
  action: FormAction;
  initial?: Record<string, string>;
  submitLabel?: string;
  cancelHref?: string;
}) => {
  // O servidor só valida dentro de submit; countAttempts numera os envios para recriar o form (ver form-attempt.ts).
  const [state, action, pending] = useActionState<WithAttempt<ContactFormState>, FormData>(countAttempts(submit), {});
  const e = state.errors ?? {};
  // Depois de um erro, vale o que a pessoa digitou; antes, os valores atuais do contato (edição).
  const v = state.values ?? initial;

  return (
    <form key={state.attempt ?? 0} action={action} className="grid gap-5 sm:grid-cols-2" noValidate>
      {state.duplicates?.length ? (
        <div className="sm:col-span-2">
          <Alert tone="warning">
            <p className="font-medium">Parece que este contato já existe (mesmo telefone ou e-mail):</p>
            <ul className="mt-1 list-disc pl-5">
              {state.duplicates.map((d) => (
                <li key={d.id}>
                  <Link href={`/contatos/${d.id}`} target="_blank" className="font-medium underline">
                    {d.name}
                  </Link>{" "}
                  · {formatPhone(d.phone)}
                  {d.email ? ` · ${d.email}` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-1">Confira antes de salvar. Se for outra pessoa, use &quot;Salvar mesmo assim&quot;.</p>
          </Alert>
          <input type="hidden" name="confirmDuplicate" value="1" />
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <Field id="name" label="Nome completo" error={e.name}>
          <Input {...fieldA11y("name", e.name)} defaultValue={v.name} required maxLength={120} autoFocus />
        </Field>
      </div>
      <Field id="phone" label="Telefone (com DDD)" error={e.phone}>
        <Input {...fieldA11y("phone", e.phone)} defaultValue={v.phone} type="tel" inputMode="tel" placeholder="(11) 91234-5678" required maxLength={30} />
      </Field>
      <Field id="whatsapp" label="Tem WhatsApp?" error={e.whatsapp} hint="Sem informação, celular conta como sim e fixo como não.">
        <Select {...fieldA11y("whatsapp", e.whatsapp, "hint")} defaultValue={v.whatsapp ?? ""}>
          <option value="">Não sei (deduzir pelo número)</option>
          <option value="true">Sim, tem WhatsApp</option>
          <option value="false">Não tem WhatsApp</option>
        </Select>
      </Field>
      <Field id="email" label="E-mail (opcional)" error={e.email}>
        <Input {...fieldA11y("email", e.email)} defaultValue={v.email} type="email" maxLength={254} />
      </Field>
      <Field id="company" label="Empresa (opcional)" error={e.company}>
        <Input {...fieldA11y("company", e.company)} defaultValue={v.company} maxLength={120} />
      </Field>
      <AddressFields values={v} errors={e} />
      <div className="sm:col-span-2">
        <Field id="origin" label="Origem" error={e.origin}>
          <Select {...fieldA11y("origin", e.origin)} defaultValue={v.origin ?? ""} required>
            <option value="" disabled>
              Selecione
            </option>
            {ORIGINS.map((o) => (
              <option key={o} value={o}>
                {ORIGIN_LABELS[o]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id="notes" label="Observações (opcional)" error={e.notes}>
          <Textarea {...fieldA11y("notes", e.notes)} defaultValue={v.notes} rows={3} maxLength={500} />
        </Field>
      </div>
      <div className="flex gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : state.duplicates?.length ? "Salvar mesmo assim" : submitLabel}
        </Button>
        <Link href={cancelHref} className={buttonClass("secondary")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
};

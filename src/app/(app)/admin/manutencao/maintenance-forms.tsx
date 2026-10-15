"use client";

import { useActionState, useState, useTransition } from "react";
import { Alert, Button, Field, Input, fieldA11y } from "@/components/ui";
import { resetDataAction, runCleanupAction, seedDemoAction, type MaintenanceState } from "./actions";

const Feedback = ({ state }: { state: MaintenanceState }) =>
  state.error ? <Alert>{state.error}</Alert> : state.message ? <Alert tone="success">{state.message}</Alert> : null;

export const CleanupNow = () => {
  const [state, setState] = useState<MaintenanceState>({});
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      <Feedback state={state} />
      <Button variant="secondary" disabled={pending} onClick={() => startTransition(async () => setState(await runCleanupAction()))}>
        {pending ? "Limpando…" : "Rodar limpeza agora"}
      </Button>
    </div>
  );
};

export const SeedDemoForm = ({ max }: { max: number }) => {
  const [state, action, pending] = useActionState<MaintenanceState, FormData>(seedDemoAction, {});
  return (
    <form action={action} className="space-y-3">
      <Feedback state={state} />
      <div className="flex items-end gap-2">
        <div className="w-36">
          <Field id="count" label="Quantidade">
            <Input {...fieldA11y("count")} type="number" min={1} max={max} defaultValue={50} required />
          </Field>
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Gerando…" : "Gerar contatos de teste"}
        </Button>
      </div>
    </form>
  );
};

export const ResetDataForm = ({ scopes }: { scopes: Record<string, string> }) => {
  const [state, action, pending] = useActionState<MaintenanceState, FormData>(resetDataAction, {});
  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-foreground">O que apagar</legend>
        {Object.entries(scopes).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="scope" value={key} defaultChecked={key === "contacts"} className="size-4 accent-primary" />
            {label}
          </label>
        ))}
      </fieldset>
      <Field id="password" label="Sua senha">
        <Input {...fieldA11y("password")} type="password" autoComplete="current-password" required maxLength={128} />
      </Field>
      <Field id="confirmation" label='Digite "LIMPAR" para confirmar'>
        <Input {...fieldA11y("confirmation")} required autoComplete="off" />
      </Field>
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Limpando…" : "Limpar a base"}
      </Button>
    </form>
  );
};

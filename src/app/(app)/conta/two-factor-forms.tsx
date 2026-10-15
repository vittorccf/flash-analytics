"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input, fieldA11y } from "@/components/ui";
import { confirmTwoFactorAction, disableTwoFactorAction, type TwoFactorState } from "./actions";

export const EnableTwoFactorForm = () => {
  const [state, action, pending] = useActionState<TwoFactorState, FormData>(confirmTwoFactorAction, {});
  return (
    <form action={action} className="space-y-3" noValidate>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Field id="code" label="Código">
            <Input {...fieldA11y("code")} inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
          </Field>
        </div>
        <div className="w-56">
          <Field id="enable-password" label="Sua senha">
            <Input id="enable-password" name="password" type="password" autoComplete="current-password" required maxLength={128} />
          </Field>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Ativando…" : "Ativar 2FA"}
        </Button>
      </div>
    </form>
  );
};

export const DisableTwoFactorForm = () => {
  const [state, action, pending] = useActionState<TwoFactorState, FormData>(disableTwoFactorAction, {});
  return (
    <form action={action} className="space-y-3" noValidate>
      <p className="text-sm text-muted-strong">Para desativar, confirme com a sua senha.</p>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Field id="password" label="Senha">
            <Input {...fieldA11y("password")} type="password" autoComplete="current-password" required maxLength={128} />
          </Field>
        </div>
        <Button type="submit" variant="danger" disabled={pending}>
          Desativar 2FA
        </Button>
      </div>
    </form>
  );
};

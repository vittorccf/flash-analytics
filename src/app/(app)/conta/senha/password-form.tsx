"use client";

import { useActionState } from "react";
import { useLiveValidation } from "@/components/live-validation";
import { changePasswordSchema } from "@/lib/validation";
import { Alert, Button, Field, Input, fieldA11y } from "@/components/ui";
import { PASSWORD_MIN } from "@/lib/password-policy";
import { changePasswordAction, type PasswordState } from "../actions";

export const PasswordForm = () => {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePasswordAction, {});
  // Mesma regra da action, conferida ao sair de cada campo (o servidor valida de novo no envio).
  const live = useLiveValidation(changePasswordSchema, state.errors);
  const e = live.errors;
  return (
    <form action={action} className="space-y-4" noValidate {...live.formProps}>
      {state.done ? <Alert tone="success">Senha alterada. As outras sessões foram encerradas.</Alert> : null}
      <Field id="current" label="Senha atual" error={e.current}>
        <Input {...fieldA11y("current", e.current)} type="password" autoComplete="current-password" required maxLength={128} />
      </Field>
      <Field id="password" label="Nova senha" error={e.password} hint={`Mínimo de ${PASSWORD_MIN} caracteres.`}>
        <Input {...fieldA11y("password", e.password, "hint")} type="password" autoComplete="new-password" required maxLength={128} />
      </Field>
      <Field id="confirm" label="Confirme a nova senha" error={e.confirm}>
        <Input {...fieldA11y("confirm", e.confirm)} type="password" autoComplete="new-password" required maxLength={128} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Trocar senha"}
      </Button>
    </form>
  );
};

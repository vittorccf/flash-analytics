"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, Field, Input, fieldA11y } from "@/components/ui";
import { verifyTwoFactorAction, type TwoFactorState } from "../actions";

export const TwoFactorForm = () => {
  const [state, action, pending] = useActionState<TwoFactorState, FormData>(verifyTwoFactorAction, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Verificação em duas etapas</h1>
        <p className="mt-1 text-sm text-muted">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>
      </div>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <Field id="code" label="Código">
        <Input
          {...fieldA11y("code", state.error)}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={7}
          required
          autoFocus
          className="text-center text-lg tracking-[0.4em]"
        />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Verificando…" : "Verificar"}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          Voltar ao login
        </Link>
      </p>
    </form>
  );
};

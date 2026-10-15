"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input, Select, fieldA11y } from "@/components/ui";
import { createUserAction, type CreateUserState } from "./actions";
import { countAttempts, type WithAttempt } from "@/lib/form-attempt";

export const CreateUserForm = () => {
  const [state, action, pending] = useActionState<WithAttempt<CreateUserState>, FormData>(countAttempts(createUserAction), {});
  const e = state.errors ?? {};
  const v = state.values ?? {};

  return (
    <form key={state.attempt ?? 0} action={action} className="space-y-4 p-5" noValidate>
      {state.created ? (
        <Alert tone="success">
          <p>
            <strong>{state.created.name}</strong> foi criado(a). Passe a senha provisória por um canal seguro — ela não
            será exibida de novo e precisará ser trocada no primeiro acesso:
          </p>
          <code className="mt-2 block select-all bg-surface px-2 py-1 font-mono text-sm text-foreground">
            {state.created.temporaryPassword}
          </code>
        </Alert>
      ) : null}
      {state.error ? <Alert>{state.error}</Alert> : null}
      <Field id="name" label="Nome completo" error={e.name}>
        <Input {...fieldA11y("name", e.name)} defaultValue={v.name} required maxLength={120} />
      </Field>
      <Field id="email" label="E-mail" error={e.email}>
        <Input {...fieldA11y("email", e.email)} defaultValue={v.email} type="email" required maxLength={254} />
      </Field>
      <Field id="role" label="Perfil" error={e.role}>
        <Select {...fieldA11y("role", e.role)} defaultValue={v.role ?? "OPERATOR"}>
          <option value="OPERATOR">Operador</option>
          <option value="ADMIN">Administrador</option>
        </Select>
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Criando…" : "Criar usuário"}
      </Button>
    </form>
  );
};

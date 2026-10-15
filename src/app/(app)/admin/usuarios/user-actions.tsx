"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { userAction, type UserActionState } from "./actions";

export const UserActions = ({
  userId,
  name,
  active,
  hasTwoFactor,
  isSelf,
}: {
  userId: string;
  name: string;
  active: boolean;
  hasTwoFactor: boolean;
  isSelf: boolean;
}) => {
  const [state, action, pending] = useActionState<UserActionState, FormData>(userAction, {});

  if (isSelf) return <span className="text-xs text-muted">Você</span>;

  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="submit" name="op" value={active ? "disable" : "enable"} variant={active ? "secondary" : "primary"} size="sm" disabled={pending} aria-label={`${active ? "Desativar" : "Reativar"} ${name}`}>
          {active ? "Desativar" : "Reativar"}
        </Button>
        {active ? (
          <Button type="submit" name="op" value="reset_password" variant="ghost" size="sm" disabled={pending} aria-label={`Redefinir senha de ${name}`}>
            Redefinir senha
          </Button>
        ) : null}
        {hasTwoFactor ? (
          <Button type="submit" name="op" value="reset_2fa" variant="ghost" size="sm" disabled={pending} aria-label={`Remover 2FA de ${name}`}>
            Remover 2FA
          </Button>
        ) : null}
      </div>
      {state.error ? (
        <p role="alert" className="text-xs text-danger-strong">
          {state.error}
        </p>
      ) : null}
      {state.done ? (
        <p role="status" className="text-xs text-success-strong">
          {state.done}
        </p>
      ) : null}
      {state.temporaryPassword ? (
        <p role="status" className="max-w-xs text-right text-xs text-muted-strong">
          Senha provisória (exibida só agora):{" "}
          <code className="select-all bg-subtle px-1.5 py-0.5 font-mono text-foreground">{state.temporaryPassword}</code>
        </p>
      ) : null}
    </form>
  );
};

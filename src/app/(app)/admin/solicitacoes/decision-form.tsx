"use client";

import { useActionState, useState } from "react";
import { Button, Input } from "@/components/ui";
import { decideSignupAction, type DecisionState } from "./actions";

export const DecisionForm = ({ id, name }: { id: string; name: string }) => {
  const [state, action, pending] = useActionState<DecisionState, FormData>(decideSignupAction, {});
  const [rejecting, setRejecting] = useState(false);

  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="id" value={id} />
      {rejecting ? (
        <div className="flex w-full max-w-xs gap-2">
          <label htmlFor={`note-${id}`} className="sr-only">
            Motivo da recusa
          </label>
          <Input id={`note-${id}`} name="note" placeholder="Motivo (opcional)" maxLength={200} autoFocus className="h-8" />
          <Button type="submit" name="decision" value="reject" variant="danger" size="sm" disabled={pending}>
            Recusar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button type="submit" name="decision" value="approve" size="sm" disabled={pending} aria-label={`Aprovar ${name}`}>
            {pending ? "Salvando…" : "Aprovar"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setRejecting(true)} aria-label={`Recusar ${name}`}>
            Recusar
          </Button>
        </div>
      )}
      {state.error ? (
        <p role="alert" className="text-xs text-danger-strong">
          {state.error}
        </p>
      ) : null}
    </form>
  );
};

"use client";

// Exclusão em dois passos (sem diálogo do navegador): "Excluir" → "Confirmar exclusão".
import { useState, useTransition } from "react";
import { Trash } from "lucide-react";
import { Button } from "@/components/ui";
import { deleteContactAction } from "./actions";

export const DeleteContact = ({ id, name }: { id: string; name: string }) => {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="danger" onClick={() => setConfirming(true)}>
        <Trash className="size-4" aria-hidden /> Excluir
      </Button>
    );
  }

  return (
    <div role="group" aria-label="Confirmar exclusão" className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-danger-strong">Excluir {name} de vez? Não dá para desfazer.</span>
      <Button variant="danger" disabled={pending} autoFocus onClick={() => startTransition(() => deleteContactAction(id))}>
        {pending ? "Excluindo…" : "Confirmar exclusão"}
      </Button>
      <Button variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
        Cancelar
      </Button>
    </div>
  );
};

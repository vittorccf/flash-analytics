"use client";

import { useActionState, useTransition } from "react";
import { Alert, Button, Field } from "./ui";

// Foto do contato: enviar ou remover. As actions vêm de fora (amarradas ao contato).
export type PhotoState = { error?: string; done?: boolean };

export const PhotoForm = ({
  preview,
  hasPhoto,
  uploadAction,
  removeAction,
}: {
  preview: React.ReactNode;
  hasPhoto: boolean;
  uploadAction: (prev: PhotoState, formData: FormData) => Promise<PhotoState>;
  removeAction: () => Promise<void>;
}) => {
  const [state, action, pending] = useActionState<PhotoState, FormData>(uploadAction, {});
  const [removing, startRemove] = useTransition();

  return (
    <div className="flex flex-wrap items-start gap-5">
      {preview}
      <form action={action} className="min-w-56 flex-1 space-y-3">
        {state.error ? <Alert>{state.error}</Alert> : null}
        {state.done ? <Alert tone="success">Foto atualizada.</Alert> : null}
        <Field id="photo" label="Nova foto" hint="PNG, JPEG ou WebP, até 1 MB. Quadrada fica melhor.">
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            aria-describedby="photo-hint"
            className="block w-full text-sm text-muted-strong file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-subtle"
          />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Enviando…" : "Salvar foto"}
          </Button>
          {hasPhoto ? (
            <Button variant="ghost" size="sm" disabled={removing} onClick={() => startRemove(() => removeAction())}>
              Remover foto
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
};

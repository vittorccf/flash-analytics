"use client";

// Notas de acompanhamento: o que foi conversado, quando e por quem. Mais recente primeiro.
import { useActionState, useTransition } from "react";
import { Trash } from "lucide-react";
import { Alert, Button, Field, Textarea, fieldA11y } from "@/components/ui";
import { formatDateTime, formatRelative } from "@/lib/format";
import { addNoteAction, deleteNoteAction, type NoteState } from "./actions";

export type NoteView = { id: string; body: string; createdAt: Date; author: { id: string; name: string } | null; avatar: React.ReactNode };

export const NotesPanel = ({
  contactId,
  notes,
  canWrite,
  currentUserId,
  isAdmin,
}: {
  contactId: string;
  notes: NoteView[];
  canWrite: boolean;
  currentUserId: string;
  isAdmin: boolean;
}) => {
  const [state, action, pending] = useActionState<NoteState, FormData>(addNoteAction.bind(null, contactId), {});
  const [deleting, startDelete] = useTransition();

  return (
    <div className="space-y-4">
      {canWrite ? (
        <form action={action} className="space-y-2">
          <Field id="body" label="Nova nota" error={state.error}>
            <Textarea {...fieldA11y("body", state.error)} rows={3} maxLength={2000} placeholder="Ex.: Liguei, pediu retorno na sexta." required />
          </Field>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Salvando…" : "Adicionar nota"}
          </Button>
        </form>
      ) : null}
      {state.ok ? <Alert tone="success">Nota adicionada.</Alert> : null}
      {notes.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma nota ainda.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="flex gap-3">
              {n.avatar}
              <div className="min-w-0 flex-1 rounded-lg bg-subtle px-3 py-2">
                <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    <strong className="font-semibold text-foreground">{n.author?.name ?? "Usuário removido"}</strong> ·{" "}
                    <time dateTime={new Date(n.createdAt).toISOString()} title={formatDateTime(n.createdAt)}>
                      {formatRelative(n.createdAt)}
                    </time>
                  </span>
                  {isAdmin || n.author?.id === currentUserId ? (
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => startDelete(() => deleteNoteAction(n.id, contactId))}
                      aria-label="Apagar nota"
                      title="Apagar nota"
                      className="p-1 text-muted hover:bg-surface hover:text-danger-strong"
                    >
                      <Trash className="size-3.5" aria-hidden />
                    </button>
                  ) : null}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-foreground">{n.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

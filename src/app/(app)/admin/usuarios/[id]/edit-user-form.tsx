"use client";

import Link from "next/link";
import { useLiveValidation } from "@/components/live-validation";
import { createUserSchema } from "@/lib/validation";
import { useActionState, useState, useTransition } from "react";
import { Trash } from "lucide-react";
import { Alert, Button, Field, Input, Select, buttonClass, chipClass, fieldA11y } from "@/components/ui";
import { ALL_PERMISSIONS, PERMISSIONS, PRESETS, presetOf, type Permission } from "@/lib/permissions";
import { deleteUserAction, updateUserAction, type EditUserState } from "./actions";

type Initial = { id: string; name: string; email: string; role: "ADMIN" | "OPERATOR"; permissions: string[] };

// Permissões do operador: atalhos prontos (Leitor, Editor…) ou ajuste fino por caixa de seleção.
const PermissionsField = ({ selected, onChange }: { selected: Permission[]; onChange: (next: Permission[]) => void }) => {
  const preset = presetOf(selected);
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-medium text-foreground">Permissões sobre contatos</legend>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Perfis prontos">
        {PRESETS.map((p) => (
          <button key={p.key} type="button" className={chipClass(preset?.key === p.key)} aria-pressed={preset?.key === p.key} title={p.description} onClick={() => onChange(p.permissions)}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">{preset ? preset.description : "Combinação personalizada."}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {ALL_PERMISSIONS.map((perm) => (
          <label key={perm} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="permissions"
              value={perm}
              checked={selected.includes(perm)}
              onChange={(ev) => onChange(ev.target.checked ? [...selected, perm] : selected.filter((p) => p !== perm))}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="font-medium text-foreground">{PERMISSIONS[perm].label}</span>
              <span className="block text-xs text-muted">{PERMISSIONS[perm].description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};

export const EditUserForm = ({ user, isSelf }: { user: Initial; isSelf: boolean }) => {
  const [state, action, pending] = useActionState<EditUserState, FormData>(updateUserAction.bind(null, user.id), {});
  const [role, setRole] = useState(user.role);
  const [permissions, setPermissions] = useState<Permission[]>(ALL_PERMISSIONS.filter((p) => user.permissions.includes(p)));
  // Mesma regra da action, conferida ao sair de cada campo (o servidor valida de novo no envio).
  const live = useLiveValidation(createUserSchema, state.errors);
  const e = live.errors;
  const v = state.values ?? user;

  return (
    <form action={action} className="space-y-4" noValidate {...live.formProps}>
      {state.saved ? <Alert tone="success">Alterações salvas.</Alert> : null}
      {state.error ? <Alert>{state.error}</Alert> : null}
      <Field id="name" label="Nome completo" error={e.name}>
        <Input {...fieldA11y("name", e.name)} defaultValue={v.name} required maxLength={120} />
      </Field>
      <Field id="email" label="E-mail" error={e.email} hint="É o login da pessoa. A senha não muda.">
        <Input {...fieldA11y("email", e.email, "hint")} defaultValue={v.email} type="email" required maxLength={254} />
      </Field>
      <Field id="role" label="Perfil" error={e.role} hint={isSelf ? "Você não pode mudar o próprio perfil." : undefined}>
        {/* Perfil próprio travado: o valor segue no envio por um campo oculto. */}
        <Select
          {...fieldA11y("role", e.role, isSelf ? "hint" : undefined)}
          name={isSelf ? undefined : "role"}
          value={role}
          onChange={(ev) => setRole(ev.target.value as Initial["role"])}
          disabled={isSelf}
        >
          <option value="OPERATOR">Operador</option>
          <option value="ADMIN">Administrador</option>
        </Select>
      </Field>
      {isSelf ? <input type="hidden" name="role" value={user.role} /> : null}
      {role === "OPERATOR" ? (
        <PermissionsField selected={permissions} onChange={setPermissions} />
      ) : (
        <>
          {/* Admin tem todas as permissões; a lista guardada só volta a valer se ele virar operador. */}
          {permissions.map((p) => (
            <input key={p} type="hidden" name="permissions" value={p} />
          ))}
          <p className="rounded-lg bg-subtle px-3 py-2 text-sm text-muted-strong">Administrador tem todas as permissões.</p>
        </>
      )}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar alterações"}
        </Button>
        <Link href="/admin/usuarios" className={buttonClass("secondary")}>
          Voltar
        </Link>
      </div>
    </form>
  );
};

export const DeleteUser = ({ id, name }: { id: string; name: string }) => {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      {error ? <Alert>{error}</Alert> : null}
      {confirming ? (
        <div role="group" aria-label="Confirmar exclusão" className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-danger-strong">Excluir {name} de vez?</span>
          <Button
            variant="danger"
            autoFocus
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteUserAction(id);
                if (result?.error) {
                  setError(result.error);
                  setConfirming(false);
                }
              })
            }
          >
            {pending ? "Excluindo…" : "Confirmar exclusão"}
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button variant="danger" onClick={() => setConfirming(true)}>
          <Trash className="size-4" aria-hidden /> Excluir usuário
        </Button>
      )}
    </div>
  );
};

"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, Field, buttonClass } from "@/components/ui";
import { importContactsAction, type ImportState } from "./actions";

export const ImportForm = () => {
  const [state, action, pending] = useActionState<ImportState, FormData>(importContactsAction, {});
  const report = state.report;

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-5">
        <Field id="file" label="Planilha (.xlsx ou .csv, até 2 MB e 2.000 contatos)">
          <input
            id="file"
            name="file"
            type="file"
            required
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="block w-full text-sm text-muted-strong file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-subtle"
          />
        </Field>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-foreground">Se alguma linha tiver erro</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="mode" value="all" defaultChecked className="mt-1 accent-primary" />
            <span>
              <strong className="font-medium">Não importar nada</strong>
              <span className="block text-muted">Recomendado: você corrige a planilha e envia de novo.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="mode" value="valid" className="mt-1 accent-primary" />
            <span>
              <strong className="font-medium">Importar só as linhas válidas</strong>
              <span className="block text-muted">As linhas com erro aparecem no relatório.</span>
            </span>
          </label>
        </fieldset>
        <Button type="submit" disabled={pending}>
          {pending ? "Importando…" : "Importar contatos"}
        </Button>
      </form>

      {state.error ? <Alert>{state.error}</Alert> : null}
      {report ? (
        <section aria-live="polite" className="space-y-3">
          <Alert tone={report.ok ? "success" : "warning"}>{report.message}</Alert>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Linhas lidas", report.totalRows],
              ["Importados", report.imported],
              ["Duplicados (pulados)", report.duplicates],
              ["Com erro", report.errors.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border px-3 py-2">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {report.ignoredColumns.length ? (
            <p className="text-xs text-muted">Colunas ignoradas (não reconhecidas): {report.ignoredColumns.join(", ")}.</p>
          ) : null}
          {report.errors.length ? (
            <div className="rounded-lg border border-border">
              <p className="border-b border-border px-4 py-2 text-sm font-medium">Linhas com erro</p>
              <ul className="max-h-72 divide-y divide-border overflow-y-auto text-sm">
                {report.errors.map((e) => (
                  <li key={e.line} className="px-4 py-2">
                    <span className="font-medium">Linha {e.line}:</span> <span className="text-danger-strong">{e.messages.join(" ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {report.imported > 0 ? (
            <Link href="/contatos" className={buttonClass("secondary")}>
              Ver contatos
            </Link>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, FileText } from "lucide-react";
import { requirePermission } from "@/server/auth/dal";
import { IMPORT_COLUMNS } from "@/server/contact-sheet";
import { Card, CardHeader, PageHeader, buttonClass } from "@/components/ui";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Importar contatos" };

const REQUIRED = new Set(["Nome", "Telefone", "Cidade", "UF"]);

export default async function ImportContactsPage() {
  await requirePermission("contacts.create");
  return (
    <>
      <Link href="/contatos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Contatos
      </Link>
      <PageHeader
        title="Importar contatos"
        description="Cada linha passa pelas mesmas regras do cadastro. Telefones já cadastrados são pulados."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="p-6">
          <ImportForm />
        </Card>
        <Card className="self-start">
          <CardHeader title="Formato da planilha" description="Primeira linha com os nomes das colunas" />
          <div className="space-y-4 p-5 text-sm">
            <div className="flex flex-wrap gap-2">
              <a href="/api/contatos/modelo?formato=xlsx" download className={buttonClass("secondary", "sm")}>
                <FileSpreadsheet className="size-4" aria-hidden /> Modelo Excel
              </a>
              <a href="/api/contatos/modelo?formato=csv" download className={buttonClass("secondary", "sm")}>
                <FileText className="size-4" aria-hidden /> Modelo CSV
              </a>
            </div>
            <ul className="space-y-1">
              {IMPORT_COLUMNS.map((c) => (
                <li key={c.key} className="flex justify-between gap-2">
                  <span>{c.header}</span>
                  <span className={REQUIRED.has(c.header) ? "text-foreground" : "text-muted"}>{REQUIRED.has(c.header) ? "obrigatória" : "opcional"}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">
              Aceita variações de nome (ex.: &quot;Celular&quot;, &quot;Estado&quot;, &quot;Município&quot;). Origem vazia vira &quot;Outro&quot;;
              WhatsApp aceita Sim/Não. O arquivo exportado pelo sistema pode ser importado de volta.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}

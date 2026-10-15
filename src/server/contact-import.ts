// Importação de contatos por planilha (CSV ou .xlsx). Cada linha passa pela MESMA validação do formulário.
// Modos: "all" (tudo ou nada: com qualquer erro, nada entra) e "valid" (entram as válidas, erros são relatados).
import "server-only";
import { db } from "./db";
import { recordAudit } from "./audit";
import { parseImportRows } from "./contact-sheet";
import { visibleTo } from "./contacts";
import { notifyAdmins } from "./notifications";
import { publish } from "./realtime/events";
import type { RequestMeta } from "./request-context";
import type { SessionUser } from "./auth/session";
import { decodeText, parseCsv } from "./spreadsheet/csv";
import { readXlsx } from "./spreadsheet/xlsx";
import { can } from "@/lib/permissions";
import { contactSchema, type ContactInput } from "@/lib/validation";

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 2_000;
const MAX_REPORTED_ERRORS = 100;

export type ImportMode = "all" | "valid";
export type ImportReport = {
  ok: boolean;
  message: string;
  totalRows: number;
  imported: number;
  duplicates: number;
  errors: { line: number; messages: string[] }[];
  ignoredColumns: string[];
};

const report = (partial: Partial<ImportReport> & { message: string }): ImportReport => ({
  ok: false,
  totalRows: 0,
  imported: 0,
  duplicates: 0,
  errors: [],
  ignoredColumns: [],
  ...partial,
});

const readRows = (fileName: string, bytes: Buffer) => {
  const name = fileName.toLowerCase();
  if (name.endsWith(".xlsx")) return readXlsx(bytes);
  if (name.endsWith(".csv") || name.endsWith(".txt")) return parseCsv(decodeText(bytes), IMPORT_MAX_ROWS + 50);
  if (name.endsWith(".xls")) throw new Error("Formato .xls antigo não é aceito. No Excel, use Salvar como → Pasta de Trabalho do Excel (.xlsx) ou CSV.");
  throw new Error("Envie um arquivo .xlsx ou .csv.");
};

export const importContacts = async (
  author: SessionUser,
  file: { name: string; bytes: Buffer },
  mode: ImportMode,
  meta: RequestMeta,
): Promise<ImportReport> => {
  if (!can(author, "contacts.create")) return report({ message: "Você não tem permissão para criar contatos." });
  let rows: string[][];
  try {
    rows = readRows(file.name, file.bytes);
  } catch (error) {
    return report({ message: error instanceof Error ? error.message : "Não foi possível ler o arquivo." });
  }

  const { records, missingColumns, ignoredColumns } = parseImportRows(rows);
  if (missingColumns.length) {
    return report({ message: `Faltam colunas obrigatórias: ${missingColumns.join(", ")}. Baixe o modelo para ver o formato.`, ignoredColumns });
  }
  if (records.length === 0) return report({ message: "A planilha não tem linhas de contato.", ignoredColumns });
  if (records.length > IMPORT_MAX_ROWS) {
    return report({ message: `Limite de ${IMPORT_MAX_ROWS.toLocaleString("pt-BR")} contatos por importação. Divida o arquivo.`, totalRows: records.length });
  }

  const valid: { line: number; input: ContactInput }[] = [];
  const errors: ImportReport["errors"] = [];
  for (const record of records) {
    const parsed = contactSchema.safeParse(record.values);
    if (parsed.success) valid.push({ line: record.line, input: parsed.data });
    else errors.push({ line: record.line, messages: [...new Set(parsed.error.issues.map((i) => i.message))] });
  }

  // Duplicados: telefone já cadastrado (no que o autor enxerga) ou repetido dentro do próprio arquivo.
  const existing = new Set(
    (
      await db.contact.findMany({
        where: { AND: [{ phone: { in: valid.map((v) => v.input.phone) } }, visibleTo(author)] },
        select: { phone: true },
      })
    ).map((c) => c.phone),
  );
  const seen = new Set<string>();
  const toInsert = valid.filter(({ input }) => {
    if (existing.has(input.phone) || seen.has(input.phone)) return false;
    seen.add(input.phone);
    return true;
  });
  const duplicates = valid.length - toInsert.length;
  const base = { totalRows: records.length, duplicates, errors: errors.slice(0, MAX_REPORTED_ERRORS), ignoredColumns };

  if (mode === "all" && errors.length) {
    return report({ ...base, message: `${errors.length} linha(s) com erro. Nada foi importado: corrija e envie de novo, ou escolha importar só as linhas válidas.` });
  }
  if (toInsert.length === 0) return report({ ...base, message: "Nenhum contato novo para importar." });

  await db.$transaction(async (tx) => {
    await tx.contact.createMany({ data: toInsert.map(({ input }) => ({ ...input, createdById: author.id })) });
    // Uma notificação resumindo a importação (e não uma por linha, que inundaria os admins).
    await notifyAdmins(
      tx,
      { type: "contacts.imported", title: "Contatos importados", body: `${author.name} importou ${toInsert.length} contato(s).`, link: "/contatos" },
      author.id,
    );
    await recordAudit(tx, {
      actorId: author.id,
      action: "contact.imported",
      entity: "Contact",
      metadata: { imported: toInsert.length, duplicates, errors: errors.length, mode },
      meta,
    });
    await publish(tx, { type: "contacts.imported", count: toInsert.length, createdById: author.id, createdByName: author.name });
  });

  return report({
    ...base,
    ok: true,
    imported: toInsert.length,
    message: `${toInsert.length} contato(s) importado(s).`,
  });
};

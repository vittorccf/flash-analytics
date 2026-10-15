// Contato ↔ planilha (CSV/Excel): colunas, conversão para exportar e leitura tolerante para importar.
import type { Contact } from "@/generated/prisma/client";
import { ORIGIN_LABELS, ORIGINS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { formatZipCode } from "@/lib/zip-code";

export const IMPORT_COLUMNS = [
  { key: "name", header: "Nome", aliases: ["nome", "nomecompleto", "contato", "name"] },
  { key: "phone", header: "Telefone", aliases: ["telefone", "celular", "fone", "tel", "whatsappnumero", "phone"] },
  { key: "whatsapp", header: "WhatsApp", aliases: ["whatsapp", "temwhatsapp", "zap"] },
  { key: "email", header: "E-mail", aliases: ["email", "mail"] },
  { key: "company", header: "Empresa", aliases: ["empresa", "company", "organizacao"] },
  { key: "zipCode", header: "CEP", aliases: ["cep", "zipcode"] },
  { key: "street", header: "Logradouro", aliases: ["logradouro", "endereco", "rua", "street"] },
  { key: "number", header: "Número", aliases: ["numero", "num", "n"] },
  { key: "district", header: "Bairro", aliases: ["bairro", "district"] },
  { key: "city", header: "Cidade", aliases: ["cidade", "municipio", "city"] },
  { key: "state", header: "UF", aliases: ["uf", "estado", "state"] },
  { key: "origin", header: "Origem", aliases: ["origem", "grupo", "origin"] },
  { key: "notes", header: "Observações", aliases: ["observacoes", "observacao", "obs", "notas", "notes"] },
] as const;

export type ImportKey = (typeof IMPORT_COLUMNS)[number]["key"];
const REQUIRED: ImportKey[] = ["name", "phone", "city", "state"];

const normalizeHeader = (h: string) =>
  h
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// --- Exportação ---

type ExportContact = Pick<
  Contact,
  "name" | "phone" | "whatsapp" | "email" | "company" | "zipCode" | "street" | "number" | "district" | "city" | "state" | "origin" | "notes" | "createdAt"
> & { createdBy: { name: string } };

export const contactsToRows = (contacts: ExportContact[]): string[][] => [
  [...IMPORT_COLUMNS.map((c) => c.header), "Cadastrado por", "Cadastrado em"],
  ...contacts.map((c) => [
    c.name,
    formatPhone(c.phone),
    c.whatsapp === null ? "" : c.whatsapp ? "Sim" : "Não",
    c.email ?? "",
    c.company ?? "",
    c.zipCode ? formatZipCode(c.zipCode) : "",
    c.street ?? "",
    c.number ?? "",
    c.district ?? "",
    c.city,
    c.state,
    ORIGIN_LABELS[c.origin],
    c.notes ?? "",
    c.createdBy.name,
    formatDateTime(c.createdAt),
  ]),
];

// Modelo para quem vai importar: cabeçalho + uma linha de exemplo.
export const templateRows = (): string[][] => [
  IMPORT_COLUMNS.map((c) => c.header),
  ["Maria da Silva", "(11) 91234-5678", "Sim", "maria@exemplo.com", "Silva & Cia", "01310-100", "Avenida Paulista", "1578", "Bela Vista", "São Paulo", "SP", "Amigos", "Amiga da faculdade"],
];

// --- Importação ---

const ORIGIN_BY_NAME = new Map<string, string>(
  ORIGINS.flatMap((o) => [
    [normalizeHeader(o), o],
    [normalizeHeader(ORIGIN_LABELS[o]), o],
  ]),
);

// Vícios comuns do Excel: número em notação científica, CEP sem o zero à esquerda.
const fixPhone = (v: string) => (/^\d+(\.\d+)?e\+?\d+$/i.test(v) ? Number(v).toFixed(0) : v);
const fixZipCode = (v: string) => {
  const digits = v.replace(/\D/g, "");
  return digits.length === 7 ? `0${digits}` : v;
};
const fixWhatsapp = (v: string) => {
  const n = normalizeHeader(v);
  if (["sim", "s", "yes", "y", "true", "1", "x", "verdadeiro"].includes(n)) return "true";
  if (["nao", "n", "no", "false", "0", "falso"].includes(n)) return "false";
  return "";
};
// Origem vazia vira "Outro"; texto desconhecido segue como está e a validação aponta o erro.
const fixOrigin = (v: string) => (v === "" ? "OUTRO" : (ORIGIN_BY_NAME.get(normalizeHeader(v)) ?? v));

export type ImportRecord = { line: number; values: Record<ImportKey, string> };
export type SheetParse = { records: ImportRecord[]; missingColumns: string[]; ignoredColumns: string[] };

export const parseImportRows = (rows: string[][]): SheetParse => {
  const headerIndex = rows.findIndex((r) => r.some((v) => v.trim() !== ""));
  if (headerIndex < 0) return { records: [], missingColumns: REQUIRED.map(headerOf), ignoredColumns: [] };

  const header = rows[headerIndex]!;
  const columnOf = new Map<ImportKey, number>();
  const ignoredColumns: string[] = [];
  header.forEach((h, i) => {
    const n = normalizeHeader(h);
    if (!n) return;
    const col = IMPORT_COLUMNS.find((c) => (c.aliases as readonly string[]).includes(n));
    if (col && !columnOf.has(col.key)) columnOf.set(col.key, i);
    else ignoredColumns.push(h);
  });
  const missingColumns = REQUIRED.filter((k) => !columnOf.has(k)).map(headerOf);

  const records: ImportRecord[] = [];
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    if (!row.some((v) => v.trim() !== "")) return; // linha em branco
    const get = (k: ImportKey) => (columnOf.has(k) ? (row[columnOf.get(k)!] ?? "").trim() : "");
    records.push({
      line: headerIndex + offset + 2, // número da linha como o usuário vê na planilha
      values: {
        name: get("name"),
        phone: fixPhone(get("phone")),
        whatsapp: fixWhatsapp(get("whatsapp")),
        email: get("email"),
        company: get("company"),
        zipCode: fixZipCode(get("zipCode")),
        street: get("street"),
        number: get("number"),
        district: get("district"),
        city: get("city"),
        state: get("state").toUpperCase(),
        origin: fixOrigin(get("origin")),
        notes: get("notes"),
      },
    });
  });
  return { records, missingColumns, ignoredColumns };
};

function headerOf(key: ImportKey) {
  return IMPORT_COLUMNS.find((c) => c.key === key)!.header;
}

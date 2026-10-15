// Exporta os contatos que o usuário pode ver, com os mesmos filtros da tela, em CSV ou Excel (.xlsx).
// Operador exporta só os seus; admin, todos. Toda exportação fica na auditoria.
import { requireUser } from "@/server/auth/dal";
import { consume } from "@/server/auth/rate-limit";
import { contactsToRows } from "@/server/contact-sheet";
import { listContactsForExport } from "@/server/contacts";
import { requestMeta } from "@/server/request-context";
import { toCsv } from "@/server/spreadsheet/csv";
import { writeXlsx } from "@/server/spreadsheet/xlsx";
import { parseContactFilters } from "@/lib/contact-filters";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!can(user, "contacts.export")) return new Response("Sem permissão para exportar.", { status: 403 });
  if (!(await consume("exportPerUser", user.id)).allowed) {
    return new Response("Muitas exportações seguidas. Aguarde alguns minutos.", { status: 429 });
  }
  const url = new URL(request.url);
  const format = url.searchParams.get("formato") === "xlsx" ? "xlsx" : "csv";
  const filters = parseContactFilters(Object.fromEntries(url.searchParams));

  const rows = contactsToRows(await listContactsForExport(user, filters, format, await requestMeta()));
  const stamp = new Date().toISOString().slice(0, 10);
  const body = format === "xlsx" ? writeXlsx(rows) : Buffer.from(toCsv(rows), "utf8");

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contatos-${stamp}.${format}"`,
      // Dado pessoal: nada de cache em proxy ou navegador.
      "Cache-Control": "no-store, private",
    },
  });
}

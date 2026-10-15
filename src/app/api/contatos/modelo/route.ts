// Modelo de planilha para importação (cabeçalho + uma linha de exemplo), em CSV ou Excel.
import { requireUser } from "@/server/auth/dal";
import { templateRows } from "@/server/contact-sheet";
import { toCsv } from "@/server/spreadsheet/csv";
import { writeXlsx } from "@/server/spreadsheet/xlsx";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireUser();
  const format = new URL(request.url).searchParams.get("formato") === "xlsx" ? "xlsx" : "csv";
  const body = format === "xlsx" ? writeXlsx(templateRows(), "Modelo") : Buffer.from(toCsv(templateRows()), "utf8");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="modelo-importacao-contatos.${format}"`,
      "Cache-Control": "no-store, private",
    },
  });
}

// Job de limpeza agendado. A Vercel chama esta rota no horário do vercel.json com
// "Authorization: Bearer $CRON_SECRET". Sem o segredo configurado, a rota fica desligada.
import { timingSafeEqualString } from "@/server/crypto";
import { runCleanup } from "@/server/maintenance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return new Response("Job não configurado (CRON_SECRET).", { status: 503 });
  const given = request.headers.get("authorization") ?? "";
  if (!timingSafeEqualString(given, `Bearer ${secret}`)) return new Response("Não autorizado", { status: 401 });

  const removed = await runCleanup("cron");
  return Response.json({ ok: true, removed }, { headers: { "Cache-Control": "no-store" } });
}

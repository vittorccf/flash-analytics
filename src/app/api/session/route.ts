// Checagem leve usada pelo cliente de tempo real para saber se a sessão ainda vale. Não estende a sessão.
import { cookies } from "next/headers";
import { loadSessionByToken, SESSION_COOKIE } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await loadSessionByToken(token, { touch: false }) : null;
  return new Response(null, { status: session ? 204 : 401, headers: { "Cache-Control": "no-store" } });
}

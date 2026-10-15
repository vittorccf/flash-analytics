// Stream de tempo real da área logada. Cada usuário só recebe o que o perfil dele pode ver:
// admin recebe tudo; operador só o que diz respeito a ele. A sessão é revalidada periodicamente
// e o stream fecha na hora se ela for revogada (usuário desativado, senha redefinida).
import { cookies } from "next/headers";
import { loadSessionByToken, SESSION_COOKIE } from "@/server/auth/session";
import { eventBus, type BusMessage } from "@/server/realtime/bus";
import { sseResponse } from "@/server/realtime/sse";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REVALIDATE_MS = 60_000;

type Viewer = { id: string; sessionId: string; role: "ADMIN" | "OPERATOR"; viewAll: boolean };

const visibleTo = (viewer: Viewer, message: BusMessage): boolean => {
  if (message.type === "resync") return true;
  if (message.type === "session.revoked") return message.userId === viewer.id && message.exceptSessionId !== viewer.sessionId;
  if (viewer.role === "ADMIN") return true;
  // Operador: eventos de contato da equipe (com "ver equipe") ou só dos próprios. Eventos de admin, nunca.
  if (!("createdById" in message)) return false;
  return viewer.viewAll || message.createdById === viewer.id;
};

export async function GET(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await loadSessionByToken(token, { touch: false }) : null;
  if (!token || !session) return new Response("Não autenticado", { status: 401 });
  // Senha provisória ainda não trocada: nada de dados em tempo real até a troca.
  if (session.user.mustChangePassword) return new Response("Troca de senha pendente", { status: 403 });
  const viewer: Viewer = { id: session.user.id, sessionId: session.id, role: session.user.role, viewAll: can(session.user, "contacts.view_all") };

  return sseResponse(request.signal, async (writer) => {
    const revoke = () => {
      writer.send("session.revoked", {});
      writer.close();
    };

    const unsubscribe = await eventBus.subscribe((message) => {
      if (!visibleTo(viewer, message)) return;
      if (message.type === "session.revoked") return revoke();
      // Perfil ou dados do próprio usuário mudaram: fecha para o navegador reconectar com o perfil atualizado.
      if (message.type === "user.changed" && message.userId === viewer.id) return writer.close();
      writer.send(message.type, message);
    });

    const timer = setInterval(async () => {
      if (!(await loadSessionByToken(token, { touch: false }).catch(() => null))) revoke();
    }, REVALIDATE_MS);

    writer.send("ready", { role: viewer.role });
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  });
}

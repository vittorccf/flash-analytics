// Stream da tela de espera. Sem sessão: quem prova a solicitação é o cookie httpOnly com o token de espera,
// e o stream só revela a situação daquela solicitação (nunca dados de outras).
import { cookies } from "next/headers";
import { SIGNUP_WAIT_COOKIE } from "@/server/auth/session";
import { eventBus } from "@/server/realtime/bus";
import { sseResponse } from "@/server/realtime/sse";
import { findWaitingRequest } from "@/server/signup-requests";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const token = (await cookies()).get(SIGNUP_WAIT_COOKIE)?.value;
  if (!token || !(await findWaitingRequest(token))) {
    return new Response("Não encontrado", { status: 404 });
  }

  return sseResponse(request.signal, async (writer) => {
    const sendCurrent = async () => {
      const current = await findWaitingRequest(token);
      if (!current) {
        writer.send("status", { status: "GONE" });
        return writer.close();
      }
      writer.send("status", { status: current.status, note: current.decisionNote });
      if (current.status !== "PENDING") writer.close();
    };

    // Assina antes de ler o estado: uma decisão entre a leitura e a assinatura não se perde.
    let requestId: string | null = null;
    const unsubscribe = await eventBus.subscribe((message) => {
      if (message.type === "resync" || (message.type === "signup.decided" && message.requestId === requestId)) {
        void sendCurrent();
      }
    });
    const current = await findWaitingRequest(token);
    requestId = current?.id ?? null;
    await sendCurrent();
    return unsubscribe;
  });
}

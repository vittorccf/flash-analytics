"use client";

// Espera da aprovação em tempo real (Server-Sent Events): nada de recarregar a página.
// Se a conexão cair, o EventSource reconecta sozinho e o servidor reenvia a situação atual.
import { useEffect, useState } from "react";
import { CircleCheck, CircleX, Hourglass } from "lucide-react";
import { Button } from "@/components/ui";
import { dismissSignupAction } from "./actions";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "GONE";
type Connection = "connecting" | "live" | "reconnecting";

export const WaitingPanel = ({ name, onDone }: { name: string; onDone: (goToLogin: boolean) => void }) => {
  const [status, setStatus] = useState<Status>("PENDING");
  const [note, setNote] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryMs = 2000;
    let finished = false;

    const open = () => {
      source = new EventSource("/api/signup-requests/stream");
      source.addEventListener("open", () => {
        setConnection("live");
        retryMs = 2000;
      });
      source.addEventListener("error", () => {
        setConnection("reconnecting");
        // Resposta de erro (ex.: 503 num deploy) faz o EventSource desistir de vez: reabrimos com espera crescente.
        if (source?.readyState === EventSource.CLOSED && !finished) {
          retryTimer = setTimeout(open, retryMs);
          retryMs = Math.min(retryMs * 2, 30_000);
        }
      });
      source.addEventListener("status", (event) => {
        const data = JSON.parse((event as MessageEvent<string>).data) as { status: Status; note?: string | null };
        setStatus(data.status);
        setNote(data.note ?? null);
        if (data.status !== "PENDING") {
          finished = true;
          source?.close();
        }
      });
    };

    open();
    return () => {
      finished = true;
      clearTimeout(retryTimer);
      source?.close();
    };
  }, []);

  const finish = async (goToLogin: boolean) => {
    await dismissSignupAction();
    onDone(goToLogin);
  };

  if (status === "APPROVED") {
    return (
      <div className="space-y-4 text-center" role="status" aria-live="polite">
        <CircleCheck className="mx-auto size-12 text-success" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">Acesso aprovado!</h1>
        <p className="text-sm text-muted">Pronto, {name.split(" ")[0]}. Entre com o e-mail e a senha que você cadastrou.</p>
        <Button className="w-full" onClick={() => finish(true)}>
          Entrar agora
        </Button>
      </div>
    );
  }

  if (status === "REJECTED" || status === "GONE") {
    return (
      <div className="space-y-4 text-center" role="status" aria-live="polite">
        <CircleX className="mx-auto size-12 text-danger" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">Solicitação não aprovada</h1>
        <p className="text-sm text-muted">
          {status === "GONE" ? "Não encontramos a sua solicitação." : "Um administrador recusou o pedido de acesso."}
        </p>
        {note ? <p className="rounded-lg bg-subtle p-3 text-sm text-muted-strong">Motivo: {note}</p> : null}
        <Button variant="secondary" className="w-full" onClick={() => finish(false)}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-center" aria-live="polite">
      <Hourglass className="mx-auto size-12 animate-pulse text-primary" aria-hidden />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Aguardando aprovação</h1>
        <p className="mt-2 text-sm text-muted">
          Obrigado, {name.split(" ")[0]}. Seu pedido foi enviado aos administradores. Mantenha esta tela aberta: ela
          muda sozinha assim que houver uma decisão.
        </p>
      </div>
      <p className="inline-flex items-center gap-2 rounded-full bg-subtle px-3 py-1 text-xs text-muted-strong">
        <span
          className={connection === "live" ? "size-2 rounded-full bg-success" : "size-2 animate-pulse rounded-full bg-warning"}
          aria-hidden
        />
        {connection === "live" ? "Conectado em tempo real" : connection === "connecting" ? "Conectando…" : "Reconectando…"}
      </p>
    </div>
  );
};

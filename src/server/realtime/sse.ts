// Resposta Server-Sent Events: heartbeat para proxies não derrubarem a conexão ociosa,
// limpeza ao desconectar e encerramento antes do limite de duração da plataforma
// (o EventSource do navegador reconecta sozinho).
import "server-only";

const encoder = new TextEncoder();
const HEARTBEAT_MS = 20_000;
const MAX_STREAM_MS = 280_000;

export type SseWriter = {
  send: (event: string, data: unknown) => void;
  close: () => void;
};

export const sseResponse = (
  signal: AbortSignal,
  start: (writer: SseWriter) => Promise<(() => void) | void>,
) => {
  let cleanup: (() => void) | void;
  let closed = false;
  const timers: ReturnType<typeof setInterval>[] = [];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        timers.forEach(clearInterval);
        cleanup?.();
        try {
          controller.close();
        } catch {
          // já fechado
        }
      };
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const writer: SseWriter = {
        send: (event, data) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        close,
      };

      signal.addEventListener("abort", close);
      // Reconexão do navegador em 3 s se cair.
      write("retry: 3000\n\n");
      timers.push(setInterval(() => write(": ping\n\n"), HEARTBEAT_MS));
      // Reconexão planejada: avisa o cliente, que então não trata a volta como "perdi eventos".
      timers.push(
        setTimeout(() => {
          writer.send("reconnect", {});
          close();
        }, MAX_STREAM_MS) as unknown as ReturnType<typeof setInterval>,
      );
      try {
        cleanup = await start(writer);
        if (closed) cleanup?.();
      } catch {
        close();
      }
    },
    cancel() {
      closed = true;
      timers.forEach(clearInterval);
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
};

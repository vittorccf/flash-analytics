"use client";

// Uma conexão SSE por aba, compartilhada por toda a área logada. Os componentes assinam os tipos
// de evento que interessam; o dado em si é sempre buscado de novo no servidor (router.refresh).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, type Toast } from "./toaster";

export type RealtimeEvent = { type: string; [key: string]: unknown };
type Handler = (event: RealtimeEvent) => void;
export type ConnectionState = "off" | "connecting" | "live" | "reconnecting";

type RealtimeContextValue = {
  subscribe: (handler: Handler) => () => void;
  connection: ConnectionState;
  notify: (toast: Omit<Toast, "id">) => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export const useRealtime = () => {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime fora do RealtimeProvider");
  return ctx;
};

const EVENT_TYPES = [
  "ready",
  "resync",
  "signup.requested",
  "signup.decided",
  "contact.created",
  "contact.updated",
  "contact.deleted",
  "contacts.imported",
  "user.changed",
  "audit.recorded",
  "session.revoked",
  "reconnect",
  "support.created",
] as const;

// enabled=false: sem conexão (ex.: senha provisória ainda não trocada, quando o servidor recusa o stream).
export const RealtimeProvider = ({ children, enabled = true }: { children: React.ReactNode; enabled?: boolean }) => {
  const handlers = useRef(new Set<Handler>());
  const [connection, setConnection] = useState<ConnectionState>(enabled ? "connecting" : "off");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((toast: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((list) => [...list.slice(-3), { ...toast, id }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 8000);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryMs = 2000;
    let stopped = false;
    let connectedBefore = false;
    // O servidor fecha o stream de tempos em tempos (limite da plataforma) e avisa antes:
    // essa volta não perdeu eventos e não deve recarregar a tela (nem renovar a sessão ociosa).
    let plannedReconnect = false;

    const dispatch = (event: RealtimeEvent) => handlers.current.forEach((h) => h(event));

    const goToLogin = () => {
      stopped = true;
      source?.close();
      // Recarga completa de propósito: sessão revogada não deixa nenhum estado do cliente para trás.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    };

    const open = () => {
      source = new EventSource("/api/events");
      source.addEventListener("open", () => {
        setConnection("live");
        retryMs = 2000;
      });
      source.addEventListener("error", async () => {
        setConnection("reconnecting");
        if (source?.readyState !== EventSource.CLOSED || stopped) return;
        // Resposta de erro encerra o EventSource: sessão ainda vale? Se não, volta ao login; se sim, reabre.
        const check = await fetch("/api/session", { cache: "no-store" }).catch(() => null);
        if (check?.status === 401) return goToLogin();
        retryTimer = setTimeout(open, retryMs);
        retryMs = Math.min(retryMs * 2, 30_000);
      });
      for (const type of EVENT_TYPES) {
        source.addEventListener(type, (e) => {
          if (type === "session.revoked") return goToLogin();
          if (type === "reconnect") {
            plannedReconnect = true;
            return;
          }
          if (type === "ready") {
            // Numa reconexão após queda, eventos podem ter se perdido: quem assina recarrega ("resync").
            if (connectedBefore && !plannedReconnect) dispatch({ type: "resync" });
            connectedBefore = true;
            plannedReconnect = false;
            return;
          }
          const data = JSON.parse((e as MessageEvent<string>).data || "{}") as Record<string, unknown>;
          dispatch({ ...data, type });
        });
      }
    };

    open();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      source?.close();
    };
  }, [enabled]);

  const subscribe = useCallback((handler: Handler) => {
    handlers.current.add(handler);
    return () => {
      handlers.current.delete(handler);
    };
  }, []);

  const value = useMemo(() => ({ subscribe, connection, notify }), [subscribe, connection, notify]);

  return (
    <RealtimeContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={(id) => setToasts((list) => list.filter((t) => t.id !== id))} />
    </RealtimeContext.Provider>
  );
};

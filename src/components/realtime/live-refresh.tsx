"use client";

// Recarrega os Server Components da página quando chega um evento da lista. Agrupa rajadas
// (vários eventos em sequência viram um único refresh).
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useRealtime } from "./realtime-provider";

const REALTIME_REFRESH_COOKIE = "flash_rt";

export const LiveRefresh = ({ events, debounceMs = 400 }: { events: string[]; debounceMs?: number }) => {
  const router = useRouter();
  const { subscribe } = useRealtime();
  const key = events.join(",");

  useEffect(() => {
    const wanted = new Set([...key.split(","), "resync"]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribe((event) => {
      if (!wanted.has(event.type)) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Marca o refresh como automático: o servidor não conta como uso da sessão (a expiração por
        // inatividade continua valendo com a aba aberta). Não é credencial; forjar só evita renovar a própria sessão.
        document.cookie = `${REALTIME_REFRESH_COOKIE}=1; max-age=10; path=/; samesite=strict`;
        router.refresh();
      }, debounceMs);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [key, debounceMs, router, subscribe]);

  return null;
};

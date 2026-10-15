"use client";

import clsx from "clsx";
import { useRealtime } from "./realtime-provider";

export const ConnectionIndicator = () => {
  const { connection } = useRealtime();
  if (connection === "off") return <span />;
  const live = connection === "live";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" role="status">
      <span className={clsx("size-2 rounded-full", live ? "bg-success" : "animate-pulse bg-warning")} aria-hidden />
      {live ? "Tempo real" : connection === "connecting" ? "Conectando…" : "Reconectando…"}
    </span>
  );
};

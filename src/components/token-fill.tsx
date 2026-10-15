"use client";

// Amostra de cor de um token (catálogo do design system). A cor é aplicada pelo navegador (CSSOM), não por
// style= no HTML: a CSP não aceita estilo inline.
import { useEffect, useRef } from "react";

export const TokenFill = ({ token, className }: { token: string; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.style.setProperty("background", `var(--color-${token})`);
  }, [token]);
  return <div ref={ref} className={className} />;
};

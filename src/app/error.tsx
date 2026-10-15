"use client";

import { Button } from "@/components/ui";

// Erro inesperado: mensagem genérica (o detalhe fica só no log do servidor) e o digest para suporte.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[60vh] place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted">Tente de novo. Se continuar, informe o código abaixo ao administrador.</p>
        {error.digest ? <code className="mt-2 block text-xs text-muted">{error.digest}</code> : null}
        <Button className="mt-6" onClick={reset}>
          Tentar de novo
        </Button>
      </div>
    </main>
  );
}

// Ícones que o lucide não tem (marcas de terceiros). Mesmo traço e grade 24×24 do lucide, para combinar.
import type { SVGProps } from "react";

// Balão de conversa com telefone, no estilo do WhatsApp (desenho próprio, não o logotipo oficial).
export const WhatsappIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z" />
    <path
      d="M9.2 8.3c.3-.5.8-.6 1.2-.3l.8.7c.3.3.3.7.1 1l-.4.6c.5.9 1.2 1.6 2.1 2.1l.6-.4c.3-.2.7-.2 1 .1l.7.8c.3.4.2.9-.3 1.2-.8.5-1.8.5-2.7.1a7 7 0 0 1-3.2-3.2c-.4-.9-.4-1.9.1-2.7z"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);

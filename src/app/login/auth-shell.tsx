import { BrandMark, Logo } from "@/components/brand";
import { SupportWidget } from "@/components/support-widget";
import { SUPPORT, SUPPORT_PHONE_LABEL } from "@/lib/support";

const SupportContact = () => (
  <p>
    Precisa de ajuda?{" "}
    <a href={`https://wa.me/55${SUPPORT.whatsapp}`} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-2 hover:underline">
      WhatsApp {SUPPORT_PHONE_LABEL}
    </a>{" "}
    ·{" "}
    <a href={`mailto:${SUPPORT.email}`} className="font-medium underline-offset-2 hover:underline">
      {SUPPORT.email}
    </a>
  </p>
);

export const AuthShell = ({ children }: { children: React.ReactNode }) => (
  <main className="grid min-h-screen lg:grid-cols-[1fr_480px]">
    <div data-surface="dark" className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
      {/* Chevrons gigantes ao fundo: a assinatura visual da marca, decorativa. */}
      <BrandMark className="pointer-events-none absolute -right-24 top-1/2 h-[120%] w-auto -translate-y-1/2 opacity-15" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 [background:var(--gradient-brand)]" />
      <Logo tone="dark" endorsed className="relative" />
      <div className="relative max-w-md space-y-4">
        <h2 className="text-4xl font-semibold leading-tight tracking-tight">
          Contatos cadastrados, aprovados e acompanhados <span className="text-brand-400">em tempo real.</span>
        </h2>
        <p className="text-sidebar-muted">
          Operadores registram contatos; administradores aprovam acessos e acompanham tudo no painel, no mesmo instante.
        </p>
      </div>
      <div className="relative space-y-1 text-sm text-sidebar-muted">
        <p>Acesso restrito. Toda ação é registrada.</p>
        <SupportContact />
      </div>
    </div>
    <div className="flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Logo endorsed className="mb-10 lg:hidden" />
        {children}
        <div className="mt-10 text-xs text-muted lg:hidden">
          <SupportContact />
        </div>
      </div>
    </div>
    <SupportWidget signedIn={false} />
  </main>
);

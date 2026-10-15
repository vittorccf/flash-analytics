"use client";

// Compartilhar o contato com alguém da equipe. O link é interno: só abre para quem tem acesso ao contato.
// O cartão (.vcf) é outra coisa: leva os dados para fora do sistema (exige "Exportar" e fica na auditoria).
import { useState } from "react";
import { Contact, Copy, Mail, Share2 } from "lucide-react";
import { ActionMenu, type ActionItem } from "@/components/action-menu";
import { WhatsappIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui";

export const ShareContact = ({ id, name, canExport }: { id: string; name: string; canExport: boolean }) => {
  // Endereço completo só existe no navegador; no servidor, o caminho basta (não aparece na tela).
  const [url] = useState(() => (typeof window === "undefined" ? `/contatos/${id}` : `${window.location.origin}/contatos/${id}`));
  const text = `Contato ${name} no Flash Contacts: ${url}`;
  const canShareNatively = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const items: ActionItem[] = [
    { label: "Copiar link", copy: url, icon: <Copy className="size-4 text-muted" aria-hidden /> },
    ...(canShareNatively
      ? [{ label: "Compartilhar…", onSelect: () => void navigator.share({ title: name, text, url }).catch(() => {}), icon: <Share2 className="size-4 text-muted" aria-hidden /> }]
      : []),
    { label: "Enviar link pelo WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(text)}`, external: true, icon: <WhatsappIcon className="size-4 text-whatsapp" aria-hidden /> },
    { label: "Enviar link por e-mail", href: `mailto:?subject=${encodeURIComponent(`Contato: ${name}`)}&body=${encodeURIComponent(text)}`, icon: <Mail className="size-4 text-muted" aria-hidden /> },
    ...(canExport ? [{ label: "Baixar cartão (.vcf)", href: `/api/contatos/${id}/vcard`, download: true, icon: <Contact className="size-4 text-muted" aria-hidden /> }] : []),
  ];

  return (
    <ActionMenu
      label="Compartilhar contato"
      trigger={
        <>
          <Share2 className="size-4" aria-hidden /> Compartilhar
        </>
      }
      triggerClassName={buttonClass("secondary")}
      hint="O link só abre para quem tem acesso a este contato no sistema."
      items={items}
    />
  );
};

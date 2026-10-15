"use client";

// Telefone e e-mail com atalhos: WhatsApp (app ou Web), ligar, SMS e e-mail (app padrão, Gmail, Outlook).
// tel:/sms:/mailto: deixam o sistema perguntar qual app usar (discador, Teams, Skype, Link to Phone…).
import { Copy, ExternalLink, Mail, MessageSquareText, Phone } from "lucide-react";
import { ActionMenu } from "./action-menu";
import { WhatsappIcon } from "./icons";
import { emailLinks, phoneLinks, whatsappAvailability, whatsappLinks } from "@/lib/contact-channels";
import { formatPhone } from "@/lib/phone";

const iconButton =
  "inline-flex size-7 items-center justify-center rounded-md text-muted-strong transition-colors hover:bg-subtle hover:text-foreground";

export const PhoneChannels = ({ phone, whatsapp, name }: { phone: string; whatsapp: boolean | null; name: string }) => {
  const wa = whatsappAvailability(phone, whatsapp);
  const waLinks = whatsappLinks(phone);
  const tel = phoneLinks(phone);
  const formatted = formatPhone(phone);
  const firstName = name.split(" ")[0];

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span>{formatted}</span>
      <ActionMenu
        label={`WhatsApp de ${firstName}`}
        trigger={<WhatsappIcon className="size-4" aria-hidden />}
        triggerClassName={`${iconButton} text-whatsapp hover:text-whatsapp`}
        disabled={!wa.available}
        disabledReason={`${wa.reason}. Para liberar, edite o contato e marque "Tem WhatsApp".`}
        hint={wa.reason}
        items={[
          { label: "Abrir no WhatsApp", href: waLinks.app, external: true, icon: <WhatsappIcon className="size-4 text-whatsapp" aria-hidden /> },
          { label: "WhatsApp Web", href: waLinks.web, external: true, icon: <ExternalLink className="size-4 text-muted" aria-hidden /> },
          { label: "Copiar número", copy: formatted, icon: <Copy className="size-4 text-muted" aria-hidden /> },
        ]}
      />
      <ActionMenu
        label={`Ligar ou enviar SMS para ${firstName}`}
        trigger={<Phone className="size-4" aria-hidden />}
        triggerClassName={iconButton}
        hint="O sistema pergunta qual app usar (celular, Teams, Skype…)."
        items={[
          { label: "Ligar", href: tel.call, icon: <Phone className="size-4 text-muted" aria-hidden /> },
          { label: "Enviar SMS", href: tel.sms, icon: <MessageSquareText className="size-4 text-muted" aria-hidden /> },
          { label: "Copiar número", copy: formatted, icon: <Copy className="size-4 text-muted" aria-hidden /> },
        ]}
      />
    </span>
  );
};

export const EmailChannels = ({ email, name }: { email: string; name: string }) => {
  const links = emailLinks(email);
  return (
    <span className="inline-flex items-center gap-1">
      <span className="truncate">{email}</span>
      <ActionMenu
        label={`Enviar e-mail para ${name.split(" ")[0]}`}
        trigger={<Mail className="size-4" aria-hidden />}
        triggerClassName={iconButton}
        items={[
          { label: "App de e-mail padrão", href: links.default, icon: <Mail className="size-4 text-muted" aria-hidden /> },
          { label: "Gmail", href: links.gmail, external: true, icon: <ExternalLink className="size-4 text-muted" aria-hidden /> },
          { label: "Outlook", href: links.outlook, external: true, icon: <ExternalLink className="size-4 text-muted" aria-hidden /> },
          { label: "Copiar e-mail", copy: email, icon: <Copy className="size-4 text-muted" aria-hidden /> },
        ]}
      />
    </span>
  );
};

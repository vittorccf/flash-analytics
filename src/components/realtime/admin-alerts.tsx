"use client";

// Notificação em tempo real para o admin: todo contato cadastrado e toda solicitação de acesso
// aparecem como aviso na tela, em qualquer página da área logada.
import { useEffect } from "react";
import { useRealtime } from "./realtime-provider";

export const AdminAlerts = ({ currentUserId }: { currentUserId: string }) => {
  const { subscribe, notify } = useRealtime();

  useEffect(
    () =>
      subscribe((event) => {
        if (event.type === "contact.created" && event.createdById !== currentUserId) {
          notify({
            title: "Novo contato cadastrado",
            body: `${String(event.createdByName)} cadastrou ${String(event.contactName)}.`,
            href: "/contatos",
          });
        }
        if (event.type === "contacts.imported" && event.createdById !== currentUserId) {
          notify({
            title: "Contatos importados",
            body: `${String(event.createdByName)} importou ${String(event.count)} contato(s).`,
            href: "/contatos",
          });
        }
        if (event.type === "support.created") {
          notify({ title: `Suporte: ${String(event.kind)}`, body: `${String(event.from)} abriu um chamado.`, href: "/admin/suporte" });
        }
        if (event.type === "signup.requested") {
          notify({
            title: "Nova solicitação de acesso",
            body: `${String(event.name)} está aguardando aprovação.`,
            href: "/admin/solicitacoes",
          });
        }
      }),
    [subscribe, notify, currentUserId],
  );

  return null;
};

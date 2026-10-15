// Eventos de domínio publicados em tempo real. Carregam só o mínimo para a interface reagir;
// o detalhe é sempre buscado de novo no servidor, com as regras de acesso de quem está vendo.
import { db, type DbTransaction } from "../db";

export const REALTIME_CHANNEL = "flash_events";

export type AppEvent =
  | { type: "signup.requested"; requestId: string; name: string }
  | { type: "signup.decided"; requestId: string; status: "APPROVED" | "REJECTED" }
  | {
      type: "contact.created";
      contactId: string;
      contactName: string;
      createdById: string;
      createdByName: string;
    }
  | { type: "contact.updated"; contactId: string; createdById: string }
  | { type: "contact.deleted"; contactId: string; createdById: string }
  | { type: "contacts.imported"; count: number; createdById: string; createdByName: string }
  | { type: "user.changed"; userId: string }
  // exceptSessionId: derruba todas as sessões do usuário menos essa (troca de senha na própria conta).
  | { type: "session.revoked"; userId: string; exceptSessionId?: string }
  | { type: "audit.recorded"; action: string }
  | { type: "support.created"; ticketId: string; from: string; kind: string };

// pg_notify dentro da transação: o evento só sai se o commit acontecer.
export const publish = async (client: DbTransaction | typeof db, event: AppEvent) => {
  await client.$executeRaw`SELECT pg_notify(${REALTIME_CHANNEL}, ${JSON.stringify(event)})`;
};

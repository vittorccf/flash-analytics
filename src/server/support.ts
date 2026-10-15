// Chamados de suporte: gravados, notificados aos admins e auditados. A mensagem para o WhatsApp do suporte é
// montada aqui, mas quem envia é a própria pessoa (o sistema não tem API de WhatsApp: ver docs/DECISOES.md).
import "server-only";
import { db } from "./db";
import { recordAudit } from "./audit";
import { notifyAdmins } from "./notifications";
import { publish } from "./realtime/events";
import type { RequestMeta } from "./request-context";
import { consumeForIp, consume } from "./auth/rate-limit";
import type { SessionUser } from "./auth/session";
import { SUPPORT_TYPES, supportLinks, supportMessage, type SupportType } from "@/lib/support";
import { offsetOf } from "@/lib/pagination";

export type NewTicket = { type: SupportType; message: string; page: string | null; name: string | null; replyTo: string | null };

export const createSupportTicket = async (user: SessionUser | null, input: NewTicket, meta: RequestMeta) => {
  // Limite por usuário (logado) ou por IP (tela de login): evita encher a caixa do suporte.
  const limited = user ? !(await consume("supportPerUser", user.id)).allowed : !(await consumeForIp("signupPerIp", meta.ip)).allowed;
  if (limited) return { ok: false as const, message: "Muitos chamados seguidos. Aguarde um pouco ou fale direto pelo WhatsApp." };

  const from = user ? `${user.name} <${user.email}>` : `${input.name ?? "Sem nome"}${input.replyTo ? ` <${input.replyTo}>` : ""}`;
  const ticket = await db.$transaction(async (tx) => {
    const t = await tx.supportTicket.create({
      data: {
        userId: user?.id ?? null,
        name: user ? null : input.name,
        replyTo: user ? null : input.replyTo,
        type: input.type,
        message: input.message,
        page: input.page,
        ipAddress: meta.ip,
      },
    });
    await notifyAdmins(tx, {
      type: "support.created",
      title: `Chamado de suporte: ${SUPPORT_TYPES[input.type]}`,
      body: `${from}: ${input.message.slice(0, 140)}`,
      link: "/admin/suporte",
    });
    await recordAudit(tx, { actorId: user?.id ?? null, action: "support.ticket_created", entity: "SupportTicket", entityId: t.id, metadata: { type: input.type }, meta });
    await publish(tx, { type: "support.created", ticketId: t.id, from: user?.name ?? input.name ?? "Visitante", kind: SUPPORT_TYPES[input.type] });
    return t;
  });

  const protocol = ticket.id.slice(-6).toUpperCase();
  return { ok: true as const, protocol, links: supportLinks(supportMessage({ protocol, type: input.type, message: input.message, from, page: input.page })) };
};

export const listSupportTickets = async (status: "OPEN" | "RESOLVED", page: number) => {
  const req = { page, pageSize: 20 };
  const where = { status };
  const [items, total] = await db.$transaction([
    db.supportTicket.findMany({
      where,
      orderBy: { createdAt: status === "OPEN" ? "asc" : "desc" },
      skip: offsetOf(req),
      take: req.pageSize,
      include: { user: { select: { name: true, email: true } } },
    }),
    db.supportTicket.count({ where }),
  ]);
  return { items, total };
};

export const openSupportCount = () => db.supportTicket.count({ where: { status: "OPEN" } });

export const resolveSupportTicket = async (id: string, adminId: string, meta: RequestMeta) => {
  const { count } = await db.supportTicket.updateMany({ where: { id, status: "OPEN" }, data: { status: "RESOLVED", resolvedAt: new Date() } });
  if (count) await recordAudit(db, { actorId: adminId, action: "support.ticket_resolved", entity: "SupportTicket", entityId: id, meta });
  return count > 0;
};

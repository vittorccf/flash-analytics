// Leitura da trilha de auditoria para o admin ("o que está acontecendo na aplicação").
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { cursorPaginate, type CursorRequest } from "@/lib/cursor";

export const ACTIVITY_GROUPS = {
  auth: { label: "Acesso", prefix: "auth." },
  signup: { label: "Solicitações", prefix: "signup." },
  user: { label: "Usuários", prefix: "user." },
  contact: { label: "Contatos", prefix: "contact." },
  support: { label: "Suporte", prefix: "support." },
} as const;

export type ActivityGroup = keyof typeof ACTIVITY_GROUPS;

export const isActivityGroup = (value: unknown): value is ActivityGroup =>
  typeof value === "string" && value in ACTIVITY_GROUPS;

// Cursor: [createdAt ISO, id]. Sem total: contar a auditoria inteira a cada página é o custo que o cursor evita.
export const ACTIVITY_CURSOR_LENGTH = 2;

export const listActivity = async (group: ActivityGroup | null, req: CursorRequest) => {
  const where: Prisma.AuditLogWhereInput = group ? { action: { startsWith: ACTIVITY_GROUPS[group].prefix } } : {};
  const at = req.cursor ? new Date(req.cursor[0]!) : null;
  const valid = at !== null && !Number.isNaN(at.getTime());
  return cursorPaginate(
    valid ? req : { ...req, cursor: null, direction: "after" },
    ({ cursor, direction, take }) => {
      const op = direction === "after" ? "lt" : "gt";
      const order = direction === "after" ? "desc" : "asc";
      return db.auditLog.findMany({
        where: cursor ? { AND: [where, { OR: [{ createdAt: { [op]: at! } }, { createdAt: at!, id: { [op]: cursor[1]! } }] }] } : where,
        orderBy: [{ createdAt: order }, { id: order }],
        take,
        include: { actor: { select: { name: true, email: true } } },
      });
    },
    (e) => [e.createdAt.toISOString(), e.id],
  );
};

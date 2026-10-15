import { db, type DbTransaction } from "./db";
import { paginate, type PageRequest } from "@/lib/pagination";

type NewNotification = { type: string; title: string; body: string; link?: string };

// Uma notificação por administrador ativo (cada um tem o próprio "lida/não lida").
// exceptUserId: o admin que fez a ação não é notificado dela.
export const notifyAdmins = async (tx: DbTransaction, notification: NewNotification, exceptUserId?: string) => {
  const admins = await tx.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE", ...(exceptUserId ? { id: { not: exceptUserId } } : {}) },
    select: { id: true },
  });
  if (admins.length === 0) return;
  await tx.notification.createMany({ data: admins.map((a) => ({ ...notification, userId: a.id })) });
};

export const unreadCount = (userId: string) => db.notification.count({ where: { userId, readAt: null } });

export const recentNotifications = (userId: string, take = 8) =>
  db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });

export const listNotifications = async (userId: string, req: PageRequest) => {
  const where = { userId };
  return paginate(
    req,
    () => db.notification.count({ where }),
    ({ skip, take }) => db.notification.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take }),
  );
};

// O filtro por userId garante que ninguém marca notificação de outra pessoa.
export const markAllRead = (userId: string) =>
  db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });

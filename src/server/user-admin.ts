// Edição e exclusão de usuários pelo admin (o restante da gestão está em users.ts).
import "server-only";
import { Prisma, type Role } from "@/generated/prisma/client";
import { db, type DbTransaction } from "./db";
import { recordAudit } from "./audit";
import { publish } from "./realtime/events";
import type { RequestMeta } from "./request-context";
import type { Outcome } from "./users";
import type { Permission } from "@/lib/permissions";

const ok = (): Outcome => ({ ok: true, value: undefined });
const fail = (message: string): Outcome<never> => ({ ok: false, message });

export const getUserForAdmin = (id: string) =>
  db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      permissions: true,
      _count: { select: { contacts: true } },
    },
  });

const otherActiveAdmins = (tx: DbTransaction, userId: string) =>
  tx.user.count({ where: { role: "ADMIN", status: "ACTIVE", id: { not: userId } } });

// Serializável: duas mudanças simultâneas não deixam o sistema sem admin.
const serializable = async (fn: (tx: DbTransaction) => Promise<Outcome>): Promise<Outcome> => {
  try {
    return await db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return fail("Já existe um usuário com este e-mail.");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return fail("Outra alteração aconteceu ao mesmo tempo. Tente de novo.");
    throw error;
  }
};

export const updateUserByAdmin = (
  userId: string,
  input: { name: string; email: string; role: Role; permissions: Permission[] },
  adminId: string,
  meta: RequestMeta,
): Promise<Outcome> =>
  serializable(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: userId }, select: { role: true, email: true, name: true, permissions: true } });
    if (!target) return fail("Usuário não encontrado.");
    const roleChanged = target.role !== input.role;
    if (roleChanged && userId === adminId) return fail("Você não pode mudar o próprio perfil.");
    if (roleChanged && target.role === "ADMIN" && (await otherActiveAdmins(tx, userId)) === 0) {
      return fail("É preciso manter ao menos um administrador ativo.");
    }
    await tx.user.update({ where: { id: userId }, data: input });
    const changed: string[] = (["name", "email", "role"] as const).filter((k) => target[k] !== input[k]);
    if ([...target.permissions].sort().join() !== [...input.permissions].sort().join()) changed.push("permissions");
    await recordAudit(tx, { actorId: adminId, action: "user.updated", entity: "User", entityId: userId, metadata: { changed }, meta });
    // O stream aberto da pessoa reconecta e passa a receber só o que o novo perfil permite.
    await publish(tx, { type: "user.changed", userId });
    return ok();
  });

// Excluir só quem não tem contatos: apagar levaria junto a autoria do histórico. Para os demais, desativar.
export const deleteUserByAdmin = (userId: string, adminId: string, meta: RequestMeta): Promise<Outcome> =>
  serializable(async (tx) => {
    if (userId === adminId) return fail("Você não pode excluir a própria conta.");
    const target = await tx.user.findUnique({ where: { id: userId }, select: { role: true, status: true, _count: { select: { contacts: true } } } });
    if (!target) return fail("Usuário não encontrado.");
    if (target._count.contacts > 0) {
      return fail(`Este usuário cadastrou ${target._count.contacts} contato(s). Desative a conta em vez de excluir, para manter o histórico.`);
    }
    if (target.role === "ADMIN" && target.status === "ACTIVE" && (await otherActiveAdmins(tx, userId)) === 0) {
      return fail("É preciso manter ao menos um administrador ativo.");
    }
    // Sessões, desafios de 2FA e notificações saem junto (cascade); a auditoria fica, sem o vínculo.
    await tx.user.delete({ where: { id: userId } });
    await recordAudit(tx, { actorId: adminId, action: "user.deleted", entity: "User", entityId: userId, metadata: { role: target.role }, meta });
    await publish(tx, { type: "session.revoked", userId });
    await publish(tx, { type: "user.changed", userId });
    return ok();
  });

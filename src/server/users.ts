// Gestão de usuários pelo admin e de conta pelo próprio usuário.
import "server-only";
import { Prisma, type Role } from "@/generated/prisma/client";
import { db } from "./db";
import { recordAudit } from "./audit";
import { encryptSecret, tryDecryptSecret } from "./crypto";
import { env } from "./env";
import { generateTemporaryPassword, hashPassword, verifyPassword } from "./auth/password";
import { generateTotpSecret, matchTotp } from "./auth/totp";
import { consume } from "./auth/rate-limit";
import { publish } from "./realtime/events";
import type { RequestMeta } from "./request-context";
import { paginate, type PageRequest } from "@/lib/pagination";

export type Outcome<T = undefined> = { ok: true; value: T } | { ok: false; message: string };
const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });
const fail = (message: string): Outcome<never> => ({ ok: false, message });

// Confere a senha dentro da conta com limite próprio: sessão roubada não vira força bruta de senha.
const checkOwnPassword = async (userId: string, password: string): Promise<Outcome> => {
  if (!(await consume("reauthPerUser", userId)).allowed) return fail("Muitas tentativas. Aguarde alguns minutos.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(user.passwordHash, password))) return fail("Senha incorreta.");
  return ok(undefined);
};

export const listUsers = async (req: PageRequest) => {
  return paginate(
    req,
    () => db.user.count(),
    ({ skip, take }) =>
      db.user.findMany({
        // Só por nome: desativar alguém não tira a linha do lugar (nem a mensagem de confirmação da tela).
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip,
        take,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          lastLoginAt: true,
          totpEnabledAt: true,
          lockedUntil: true,
          mustChangePassword: true,
          createdAt: true,
          permissions: true,
          _count: { select: { contacts: true, sessions: { where: { expiresAt: { gt: new Date() } } } } },
        },
      }),
  );
};

export const createUserByAdmin = async (
  input: { name: string; email: string; role: Role },
  adminId: string,
  meta: RequestMeta,
): Promise<Outcome<{ temporaryPassword: string }>> => {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  try {
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { ...input, passwordHash, mustChangePassword: true, createdById: adminId },
      });
      // Pedido pendente com o mesmo e-mail perde o sentido: a conta já existe.
      await tx.signupRequest.updateMany({
        where: { email: input.email, status: "PENDING" },
        data: { status: "REJECTED", decidedAt: new Date(), decidedById: adminId, passwordHash: null, decisionNote: "Conta criada pelo administrador." },
      });
      await recordAudit(tx, { actorId: adminId, action: "user.created", entity: "User", entityId: user.id, metadata: { role: input.role }, meta });
      await publish(tx, { type: "user.changed", userId: user.id });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return fail("Já existe um usuário com este e-mail.");
    throw error;
  }
  return ok({ temporaryPassword });
};

// Desativar: derruba todas as sessões na hora e avisa os navegadores abertos (tempo real).
export const setUserStatus = async (
  userId: string,
  status: "ACTIVE" | "DISABLED",
  adminId: string,
  meta: RequestMeta,
): Promise<Outcome> => {
  if (userId === adminId) return fail("Você não pode desativar a própria conta.");
  try {
    return await db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target) return fail("Usuário não encontrado.");
    if (status === "DISABLED" && target.role === "ADMIN") {
      const otherAdmins = await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE", id: { not: userId } } });
      if (otherAdmins === 0) return fail("É preciso manter ao menos um administrador ativo.");
    }
    await tx.user.update({ where: { id: userId }, data: { status, failedLoginAttempts: 0, lockedUntil: null } });
    if (status === "DISABLED") {
      await tx.session.deleteMany({ where: { userId } });
      await publish(tx, { type: "session.revoked", userId });
    }
    await recordAudit(tx, { actorId: adminId, action: status === "DISABLED" ? "user.disabled" : "user.enabled", entity: "User", entityId: userId, meta });
    await publish(tx, { type: "user.changed", userId });
    return ok(undefined);
    // Serializável: dois admins desativando um ao outro ao mesmo tempo não deixam o sistema sem admin.
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return fail("Outra alteração aconteceu ao mesmo tempo. Tente de novo.");
    throw error;
  }
};

export const resetUserPassword = async (userId: string, adminId: string, meta: RequestMeta): Promise<Outcome<{ temporaryPassword: string }>> => {
  if (userId === adminId) return fail("Para trocar a sua senha, use Minha conta.");
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  return db.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true, passwordChangedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
    if (count === 0) return fail("Usuário não encontrado.");
    await tx.session.deleteMany({ where: { userId } });
    await publish(tx, { type: "session.revoked", userId });
    await recordAudit(tx, { actorId: adminId, action: "user.password_reset", entity: "User", entityId: userId, meta });
    return ok({ temporaryPassword });
  });
};

export const resetUserTwoFactor = async (userId: string, adminId: string, meta: RequestMeta): Promise<Outcome> =>
  db.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({
      where: { id: userId },
      data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null },
    });
    if (count === 0) return fail("Usuário não encontrado.");
    await recordAudit(tx, { actorId: adminId, action: "user.2fa_reset", entity: "User", entityId: userId, meta });
    await publish(tx, { type: "user.changed", userId });
    return ok(undefined);
  });

// Troca de senha pelo próprio usuário: confere a atual e encerra as outras sessões.
export const changeOwnPassword = async (
  userId: string,
  currentSessionId: string,
  current: string,
  next: string,
  meta: RequestMeta,
): Promise<Outcome> => {
  const check = await checkOwnPassword(userId, current);
  if (!check.ok) return fail(check.message === "Senha incorreta." ? "Senha atual incorreta." : check.message);
  if (current === next) return fail("A nova senha precisa ser diferente da atual.");
  const passwordHash = await hashPassword(next);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date() } });
    await tx.session.deleteMany({ where: { userId, id: { not: currentSessionId } } });
    await tx.loginChallenge.deleteMany({ where: { userId } });
    // Outras abas/navegadores abertos caem na hora (a atual fica).
    await publish(tx, { type: "session.revoked", userId, exceptSessionId: currentSessionId });
    await recordAudit(tx, { actorId: userId, action: "auth.password_changed", entity: "User", entityId: userId, meta });
  });
  return ok(undefined);
};

// --- 2FA do próprio usuário ---

// Gera (ou reaproveita) um segredo ainda não ativado; só vale depois de confirmado com um código.
export const beginTwoFactorEnrollment = async (userId: string) => {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { totpSecret: true, totpEnabledAt: true } });
  if (user.totpEnabledAt) return null;
  // Segredo pendente de outra chave (ENCRYPTION_KEY trocada): como ninguém o ativou, gera outro.
  const pending = user.totpSecret ? tryDecryptSecret(user.totpSecret, env.encryptionKey) : null;
  if (pending) return pending;
  const secret = generateTotpSecret();
  await db.user.update({ where: { id: userId }, data: { totpSecret: encryptSecret(secret, env.encryptionKey) } });
  return secret;
};

// Ativar 2FA exige a senha: quem rouba uma sessão não consegue amarrar a conta ao celular dele.
export const confirmTwoFactorEnrollment = async (userId: string, password: string, code: string, meta: RequestMeta): Promise<Outcome> => {
  const check = await checkOwnPassword(userId, password);
  if (!check.ok) return check;
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { totpSecret: true, totpEnabledAt: true } });
  if (user.totpEnabledAt) return fail("A verificação em duas etapas já está ativa.");
  if (!user.totpSecret) return fail("Recomece a configuração.");
  const secret = tryDecryptSecret(user.totpSecret, env.encryptionKey);
  if (!secret) return fail("Recomece a configuração: recarregue a página para gerar um novo QR code.");
  const step = matchTotp(secret, code);
  if (step === null) return fail("Código inválido. Confira o horário do celular e tente de novo.");
  await db.user.update({ where: { id: userId }, data: { totpEnabledAt: new Date(), totpLastStep: step } });
  await recordAudit(db, { actorId: userId, action: "auth.2fa_enabled", entity: "User", entityId: userId, meta });
  return ok(undefined);
};

export const disableOwnTwoFactor = async (userId: string, password: string, meta: RequestMeta): Promise<Outcome> => {
  const check = await checkOwnPassword(userId, password);
  if (!check.ok) return check;
  await db.user.update({ where: { id: userId }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null } });
  await recordAudit(db, { actorId: userId, action: "auth.2fa_disabled", entity: "User", entityId: userId, meta });
  return ok(undefined);
};

export const listOwnSessions = (userId: string) =>
  db.session.findMany({
    where: { userId },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, createdAt: true, lastSeenAt: true, ipAddress: true, userAgent: true },
  });

export const revokeOtherSessions = async (userId: string, currentSessionId: string, meta: RequestMeta) => {
  await db.session.deleteMany({ where: { userId, id: { not: currentSessionId } } });
  await publish(db, { type: "session.revoked", userId, exceptSessionId: currentSessionId });
  await recordAudit(db, { actorId: userId, action: "auth.sessions_revoked", entity: "User", entityId: userId, meta });
};

// Caso de uso "entrar". Ordem das defesas:
// 1. limite por IP e por falhas de e-mail (força bruta e credential stuffing, inclusive em e-mails que não existem);
// 2. mesma resposta e mesmo custo para e-mail inexistente, senha errada, conta bloqueada ou desativada;
// 3. bloqueio temporário da conta após MAX_FAILED_ATTEMPTS erros — de senha OU de código 2FA. A tentativa é
//    "reservada" no banco ANTES de verificar a senha: requisições paralelas não passam do limite;
// 4. 2FA, quando ativo, antes de a sessão existir.
import "server-only";
import { cookies } from "next/headers";
import { db } from "../db";
import { recordAudit } from "../audit";
import { generateToken, hashToken, tryDecryptSecret } from "../crypto";
import { env } from "../env";
import type { RequestMeta } from "../request-context";
import { burnPasswordCheck, verifyPassword } from "./password";
import { consume, consumeForIp, isLimited } from "./rate-limit";
import { CHALLENGE_COOKIE, clearCookie, cookieOptions, createSession } from "./session";
import { matchTotp } from "./totp";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const CHALLENGE_MAX_ATTEMPTS = 5;

export const INVALID_CREDENTIALS = `E-mail ou senha incorretos. Após ${MAX_FAILED_ATTEMPTS} tentativas erradas, o acesso fica bloqueado por ${LOCK_MINUTES} minutos.`;
export const TOO_MANY_ATTEMPTS = "Muitas tentativas a partir desta rede. Aguarde alguns minutos e tente de novo.";
export const INVALID_CODE = "Código inválido ou expirado.";
const CHALLENGE_EXPIRED = "Sua etapa de verificação expirou. Entre de novo.";

export type LoginOutcome =
  | { status: "authenticated"; userId: string }
  | { status: "two_factor_required" }
  | { status: "error"; message: string };

// Reserva uma tentativa antes de verificar: só passa se a conta não está bloqueada e ainda há tentativas.
// O incremento e a checagem são a mesma instrução SQL, então 100 requisições paralelas não viram 100 tentativas.
const reserveAttempt = async (userId: string) => {
  const { count } = await db.user.updateMany({
    where: {
      id: userId,
      failedLoginAttempts: { lt: MAX_FAILED_ATTEMPTS },
      OR: [{ lockedUntil: null }, { lockedUntil: { lte: new Date() } }],
    },
    data: { failedLoginAttempts: { increment: 1 } },
  });
  return count === 1;
};

// Tentativa que não foi erro (senha certa indo para o 2FA, conta desativada): devolve a reserva.
const releaseAttempt = (userId: string) =>
  db.user.updateMany({ where: { id: userId, failedLoginAttempts: { gt: 0 } }, data: { failedLoginAttempts: { decrement: 1 } } });

// A tentativa reservada falhou: se esgotou, bloqueia (e zera o contador para depois do bloqueio).
const settleFailure = async (userId: string, action: "auth.login_failed" | "auth.2fa_failed", meta: RequestMeta) => {
  const { count: locked } = await db.user.updateMany({
    where: { id: userId, failedLoginAttempts: { gte: MAX_FAILED_ATTEMPTS } },
    data: { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) },
  });
  await recordAudit(db, { actorId: userId, action: locked ? "auth.login_locked" : action, entity: "User", entityId: userId, meta });
  return locked > 0;
};

const startSession = async (userId: string, meta: RequestMeta) => {
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null } });
  await createSession(userId, meta);
  await recordAudit(db, { actorId: userId, action: "auth.login", entity: "User", entityId: userId, meta });
};

export const authenticate = async (email: string, password: string, meta: RequestMeta): Promise<LoginOutcome> => {
  const [byIp, emailLimited] = await Promise.all([consumeForIp("loginPerIp", meta.ip), isLimited("loginFailuresPerEmail", email)]);
  if (!byIp.allowed || emailLimited) {
    await recordAudit(db, { action: "auth.rate_limited", metadata: { email }, meta });
    return { status: "error", message: TOO_MANY_ATTEMPTS };
  }
  const countEmailFailure = () => consume("loginFailuresPerEmail", email);

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    await burnPasswordCheck(password);
    await countEmailFailure();
    await recordAudit(db, { action: "auth.login_failed", metadata: { email, reason: "unknown_email" }, meta });
    return { status: "error", message: INVALID_CREDENTIALS };
  }

  if (!(await reserveAttempt(user.id))) {
    await burnPasswordCheck(password);
    await countEmailFailure();
    await recordAudit(db, { actorId: user.id, action: "auth.login_blocked", metadata: { reason: "locked" }, meta });
    return { status: "error", message: INVALID_CREDENTIALS };
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    await countEmailFailure();
    await settleFailure(user.id, "auth.login_failed", meta);
    return { status: "error", message: INVALID_CREDENTIALS };
  }

  // Só depois da senha certa: quem não sabe a senha não descobre que a conta foi desativada.
  if (user.status !== "ACTIVE") {
    await releaseAttempt(user.id);
    await recordAudit(db, { actorId: user.id, action: "auth.login_blocked", metadata: { reason: "disabled" }, meta });
    return { status: "error", message: INVALID_CREDENTIALS };
  }

  if (user.totpEnabledAt && user.totpSecret) {
    // O contador NÃO zera aqui: erros de código somam com erros de senha, então saber a senha
    // não dá direito a tentativas ilimitadas de 2FA (cada login novo não "recarrega" a cota).
    await releaseAttempt(user.id);
    const token = generateToken();
    await db.loginChallenge.deleteMany({ where: { userId: user.id } });
    await db.loginChallenge.create({
      data: { id: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) },
    });
    (await cookies()).set(CHALLENGE_COOKIE, token, cookieOptions(CHALLENGE_TTL_MS / 1000));
    return { status: "two_factor_required" };
  }

  await startSession(user.id, meta);
  return { status: "authenticated", userId: user.id };
};

export const hasPendingChallenge = async () => Boolean((await cookies()).get(CHALLENGE_COOKIE)?.value);

const dropChallenge = async (id: string) => {
  await db.loginChallenge.deleteMany({ where: { id } });
  await clearCookie(CHALLENGE_COOKIE);
};

export const completeTwoFactor = async (code: string, meta: RequestMeta): Promise<LoginOutcome> => {
  if (!(await consumeForIp("twoFactorPerIp", meta.ip)).allowed) return { status: "error", message: TOO_MANY_ATTEMPTS };

  const token = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (!token || token.length > 100) return { status: "error", message: CHALLENGE_EXPIRED };
  const id = hashToken(token);

  // Reserva a tentativa no desafio antes de verificar (mesmo motivo do login: paralelismo).
  const { count: reserved } = await db.loginChallenge.updateMany({
    where: { id, attempts: { lt: CHALLENGE_MAX_ATTEMPTS }, expiresAt: { gt: new Date() } },
    data: { attempts: { increment: 1 } },
  });
  const challenge = reserved ? await db.loginChallenge.findUnique({ where: { id }, include: { user: true } }) : null;
  if (!challenge) {
    await dropChallenge(id);
    return { status: "error", message: CHALLENGE_EXPIRED };
  }

  const { user } = challenge;
  // Cada código também consome uma tentativa da conta: conta bloqueada não testa códigos.
  if (!(await reserveAttempt(user.id))) {
    await dropChallenge(id);
    return { status: "error", message: CHALLENGE_EXPIRED };
  }

  // Segredo que não decifra (chave trocada) conta como código inválido; o admin pode remover o 2FA da pessoa.
  const secret = user.totpSecret ? tryDecryptSecret(user.totpSecret, env.encryptionKey) : null;
  const step = secret ? matchTotp(secret, code) : null;
  // Mesmo código não vale duas vezes (replay). O "claim" do passo é atômico.
  const claimed =
    step !== null && user.status === "ACTIVE"
      ? await db.user.updateMany({
          where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
          data: { totpLastStep: step },
        })
      : { count: 0 };
  if (claimed.count === 0) {
    if (await settleFailure(user.id, "auth.2fa_failed", meta)) await dropChallenge(id);
    return { status: "error", message: INVALID_CODE };
  }

  await db.loginChallenge.deleteMany({ where: { userId: user.id } });
  await clearCookie(CHALLENGE_COOKIE);
  await startSession(user.id, meta);
  return { status: "authenticated", userId: user.id };
};

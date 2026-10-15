// Solicitação de acesso do operador: nasce na tela de login, espera a decisão de um admin em tempo real.
import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { cookies } from "next/headers";
import { db } from "./db";
import { recordAudit } from "./audit";
import { generateToken, hashToken } from "./crypto";
import { hashPassword } from "./auth/password";
import { consumeForIp } from "./auth/rate-limit";
import { cookieOptions, SIGNUP_WAIT_COOKIE } from "./auth/session";
import { notifyAdmins } from "./notifications";
import { publish } from "./realtime/events";
import type { RequestMeta } from "./request-context";
import { paginate, type PageRequest } from "@/lib/pagination";

const WAIT_COOKIE_DAYS = 7;

export type SignupOutcome = { ok: true } | { ok: false; message: string };

export const UNAVAILABLE =
  "Não foi possível enviar a solicitação com este e-mail. Se você já tem acesso, entre com e-mail e senha; se já pediu, aguarde a análise.";

export const createSignupRequest = async (
  input: { name: string; email: string; password: string },
  meta: RequestMeta,
): Promise<SignupOutcome> => {
  if (!(await consumeForIp("signupPerIp", meta.ip)).allowed) {
    return { ok: false, message: "Muitas solicitações a partir desta rede. Tente novamente mais tarde." };
  }
  if (await db.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
    return { ok: false, message: UNAVAILABLE };
  }

  const waitToken = generateToken();
  const passwordHash = await hashPassword(input.password);
  try {
    await db.$transaction(async (tx) => {
      const request = await tx.signupRequest.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          waitTokenHash: hashToken(waitToken),
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
        },
      });
      await notifyAdmins(tx, {
        type: "signup.requested",
        title: "Nova solicitação de acesso",
        body: `${input.name} pediu acesso como operador.`,
        link: "/admin/solicitacoes",
      });
      await recordAudit(tx, { action: "signup.requested", entity: "SignupRequest", entityId: request.id, metadata: { email: input.email }, meta });
      await publish(tx, { type: "signup.requested", requestId: request.id, name: input.name });
    });
  } catch (error) {
    // Índice único parcial: já existe solicitação pendente para este e-mail.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, message: UNAVAILABLE };
    throw error;
  }

  (await cookies()).set(SIGNUP_WAIT_COOKIE, waitToken, cookieOptions(WAIT_COOKIE_DAYS * 24 * 60 * 60));
  return { ok: true };
};

// O que a tela de espera pode saber: nome e situação da própria solicitação, nada mais.
export const findWaitingRequest = async (waitToken: string | undefined) => {
  if (!waitToken || waitToken.length > 100) return null;
  return db.signupRequest.findUnique({
    where: { waitTokenHash: hashToken(waitToken) },
    select: { id: true, name: true, email: true, status: true, decisionNote: true },
  });
};

export const currentWaitingRequest = async () => findWaitingRequest((await cookies()).get(SIGNUP_WAIT_COOKIE)?.value);

export const listSignupRequests = async (status: "PENDING" | "DECIDED", req: PageRequest) => {
  const where: Prisma.SignupRequestWhereInput = status === "PENDING" ? { status: "PENDING" } : { status: { not: "PENDING" } };
  return paginate(
    req,
    () => db.signupRequest.count({ where }),
    ({ skip, take }) =>
      db.signupRequest.findMany({
        where,
        orderBy: [{ createdAt: status === "PENDING" ? "asc" : "desc" }, { id: "asc" }],
        skip,
        take,
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
          decidedAt: true,
          decisionNote: true,
          ipAddress: true,
          decidedBy: { select: { name: true } },
        },
      }),
  );
};

export const pendingSignupCount = () => db.signupRequest.count({ where: { status: "PENDING" } });

export type DecisionOutcome = { ok: true } | { ok: false; message: string };

export const approveSignupRequest = async (requestId: string, adminId: string, meta: RequestMeta): Promise<DecisionOutcome> => {
  try {
    return await db.$transaction(async (tx) => {
      const request = await tx.signupRequest.findUnique({ where: { id: requestId } });
      if (!request || request.status !== "PENDING" || !request.passwordHash) {
        return { ok: false, message: "Esta solicitação já foi analisada." } as const;
      }
      const user = await tx.user.create({
        data: { name: request.name, email: request.email, passwordHash: request.passwordHash, role: "OPERATOR", createdById: adminId },
      });
      // Só decide se ainda estiver pendente: dois admins aprovando ao mesmo tempo não criam duas decisões.
      const { count } = await tx.signupRequest.updateMany({
        where: { id: requestId, status: "PENDING" },
        data: { status: "APPROVED", decidedAt: new Date(), decidedById: adminId, passwordHash: null, userId: user.id },
      });
      if (count === 0) throw new Error("concorrência");
      await recordAudit(tx, { actorId: adminId, action: "signup.approved", entity: "SignupRequest", entityId: requestId, metadata: { userId: user.id }, meta });
      await publish(tx, { type: "signup.decided", requestId, status: "APPROVED" });
      await publish(tx, { type: "user.changed", userId: user.id });
      return { ok: true } as const;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, message: "Já existe um usuário com este e-mail. Recuse a solicitação." };
    }
    if (error instanceof Error && error.message === "concorrência") return { ok: false, message: "Esta solicitação já foi analisada." };
    throw error;
  }
};

export const rejectSignupRequest = async (
  requestId: string,
  adminId: string,
  note: string | null,
  meta: RequestMeta,
): Promise<DecisionOutcome> =>
  db.$transaction(async (tx) => {
    const { count } = await tx.signupRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: "REJECTED", decidedAt: new Date(), decidedById: adminId, passwordHash: null, decisionNote: note },
    });
    if (count === 0) return { ok: false, message: "Esta solicitação já foi analisada." } as const;
    await recordAudit(tx, { actorId: adminId, action: "signup.rejected", entity: "SignupRequest", entityId: requestId, meta });
    await publish(tx, { type: "signup.decided", requestId, status: "REJECTED" });
    return { ok: true } as const;
  });

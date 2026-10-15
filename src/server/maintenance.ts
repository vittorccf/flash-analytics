// Manutenção da base: limpeza periódica (job), geração de dados de teste e limpeza total.
// Sem "server-only" de propósito: o mesmo código roda pelo script de linha de comando (cron on-premises).
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { recordAudit } from "./audit";
import { publish } from "./realtime/events";
import type { RequestMeta } from "./request-context";
import { generateDemoContacts } from "@/lib/demo-data";
import { SESSION_IDLE_MS } from "./auth/session-policy";

const DAY = 24 * 60 * 60 * 1000;
// Retenção: o que não tem mais uso operacional sai da base (minimização de dados, LGPD).
export const RETENTION = {
  readNotificationsDays: 90,
  decidedSignupRequestsDays: 180,
  rateLimitBucketsDays: 1,
};

// Job de limpeza: tudo que já expirou ou passou do prazo de retenção. Idempotente: rodar duas vezes não faz mal.
export const runCleanup = async (via: "cron" | "cli" | "admin", actorId: string | null = null, now = new Date()) => {
  const t = now.getTime();
  const [sessions, challenges, buckets, notifications, signupRequests] = await db.$transaction([
    db.session.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { lastSeenAt: { lt: new Date(t - SESSION_IDLE_MS) } }] } }),
    db.loginChallenge.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date(t - RETENTION.rateLimitBucketsDays * DAY) } } }),
    db.notification.deleteMany({ where: { readAt: { lt: new Date(t - RETENTION.readNotificationsDays * DAY) } } }),
    db.signupRequest.deleteMany({ where: { status: { not: "PENDING" }, decidedAt: { lt: new Date(t - RETENTION.decidedSignupRequestsDays * DAY) } } }),
  ]);
  const removed = {
    sessions: sessions.count,
    loginChallenges: challenges.count,
    rateLimitBuckets: buckets.count,
    readNotifications: notifications.count,
    decidedSignupRequests: signupRequests.count,
  };
  await recordAudit(db, { actorId, action: "system.cleanup", entity: "System", metadata: { via, ...removed } });
  return removed;
};

// Fora de produção, tudo liberado. Em produção, cada um com a sua variável: limpar a base apaga dados sem volta
// (ALLOW_DATA_RESET); dados de teste só acrescentam contatos fictícios (ALLOW_DEMO_DATA, ou a de limpeza).
const isProduction = () => process.env.NODE_ENV === "production";
export const dataResetAllowed = () => !isProduction() || process.env.ALLOW_DATA_RESET === "true";
export const demoDataAllowed = () => dataResetAllowed() || process.env.ALLOW_DEMO_DATA === "true";

export const RESET_SCOPES = {
  contacts: "Contatos (com notas e favoritos)",
  notifications: "Notificações",
  signupRequests: "Solicitações de acesso já decididas",
} as const;
export type ResetScope = keyof typeof RESET_SCOPES;

// Usuários e auditoria nunca são apagados aqui: a própria limpeza fica registrada.
export const resetData = async (adminId: string, scopes: ResetScope[], meta: RequestMeta) => {
  if (!dataResetAllowed()) throw new Error("Limpeza da base desativada neste ambiente.");
  const removed: Partial<Record<ResetScope, number>> = {};
  await db.$transaction(async (tx) => {
    if (scopes.includes("contacts")) removed.contacts = (await tx.contact.deleteMany({})).count;
    if (scopes.includes("notifications")) removed.notifications = (await tx.notification.deleteMany({})).count;
    if (scopes.includes("signupRequests")) removed.signupRequests = (await tx.signupRequest.deleteMany({ where: { status: { not: "PENDING" } } })).count;
    await recordAudit(tx, { actorId: adminId, action: "system.data_reset", entity: "System", metadata: removed as Prisma.InputJsonObject, meta });
    // Telas abertas recarregam (lista, painel) como numa importação.
    await publish(tx, { type: "contacts.imported", count: 0, createdById: adminId, createdByName: "Manutenção" });
  });
  return removed;
};

export const DEMO_MAX = 500;

// Distribui os contatos entre os operadores ativos (ou no próprio admin, se não houver operador).
export const seedDemoContacts = async (adminId: string, count: number, meta: RequestMeta | undefined, seed = Date.now()) => {
  if (!demoDataAllowed()) throw new Error("Geração de dados de teste desativada neste ambiente.");
  const n = Math.max(1, Math.min(DEMO_MAX, Math.floor(count)));
  const authors = (await db.user.findMany({ where: { role: "OPERATOR", status: "ACTIVE" }, select: { id: true } })).map((u) => u.id);
  const pool = authors.length ? authors : [adminId];
  const contacts = generateDemoContacts(n, seed);
  await db.$transaction(async (tx) => {
    await tx.contact.createMany({ data: contacts.map((c, i) => ({ ...c, createdById: pool[i % pool.length]! })) });
    await recordAudit(tx, { actorId: adminId, action: "system.demo_seeded", entity: "System", metadata: { count: n }, meta });
    await publish(tx, { type: "contacts.imported", count: n, createdById: adminId, createdByName: "Dados de teste" });
  });
  return n;
};

// Métricas do painel do admin. Os números de contatos vêm de "ContactStat" (agregados por dia/origem/UF/DDD/autor,
// mantidos por trigger na mesma transação da escrita): o painel lê poucas linhas, com qualquer volume de contatos.
// O "dia" é o de São Paulo, já resolvido no trigger.
import "server-only";
import type { ContactOrigin } from "@/generated/prisma/client";
import { db } from "./db";
import { loadPhoneRegions } from "./phone-regions";

const TZ = "America/Sao_Paulo";

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;

const contactTotals = async () => {
  const rows = await db.$queryRaw<{ total: number; today: number; last7: number; prev7: number }[]>`
    WITH t AS (SELECT (now() AT TIME ZONE ${TZ})::date AS today)
    SELECT
      coalesce(sum(s.count), 0)::int AS total,
      coalesce(sum(s.count) FILTER (WHERE s.day = t.today), 0)::int AS today,
      coalesce(sum(s.count) FILTER (WHERE s.day > t.today - 7), 0)::int AS last7,
      coalesce(sum(s.count) FILTER (WHERE s.day <= t.today - 7 AND s.day > t.today - 14), 0)::int AS prev7
    FROM t LEFT JOIN "ContactStat" s ON true`;
  return rows[0] ?? { total: 0, today: 0, last7: 0, prev7: 0 };
};

const contactsPerDay = (days: number) =>
  db.$queryRaw<{ day: string; count: number }[]>`
    SELECT to_char(d, 'YYYY-MM-DD') AS day, coalesce(sum(s.count), 0)::int AS count
    FROM generate_series((now() AT TIME ZONE ${TZ})::date - ${days - 1}::int, (now() AT TIME ZONE ${TZ})::date, interval '1 day') AS d
    LEFT JOIN "ContactStat" s ON s.day = d::date
    GROUP BY d ORDER BY d`;

// Contatos excluídos deixam linhas com 0 nos agregados: HAVING tira as dimensões que zeraram.
const contactsByOrigin = () =>
  db.$queryRaw<{ origin: ContactOrigin; count: number }[]>`
    SELECT origin::text AS origin, sum(count)::int AS count
    FROM "ContactStat" GROUP BY 1 HAVING sum(count) > 0 ORDER BY 2 DESC, 1`;

const contactsByState = () =>
  db.$queryRaw<{ state: string; count: number }[]>`
    SELECT state::text AS state, sum(count)::int AS count
    FROM "ContactStat" GROUP BY 1 HAVING sum(count) > 0 ORDER BY 2 DESC, 1 LIMIT 10`;

const securityLast24h = async () => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const groups = await db.auditLog.groupBy({
    by: ["action"],
    where: { createdAt: { gte: since }, action: { startsWith: "auth." } },
    _count: { _all: true },
  });
  const count = (...actions: string[]) =>
    groups.filter((g) => actions.includes(g.action)).reduce((sum, g) => sum + g._count._all, 0);
  return {
    logins: count("auth.login"),
    failures: count("auth.login_failed", "auth.2fa_failed"),
    blocked: count("auth.login_locked", "auth.login_blocked", "auth.rate_limited"),
  };
};

const contactsByOperator = async () => {
  const top = await db.$queryRaw<{ id: string; count: number }[]>`
    SELECT "createdById" AS id, sum(count)::int AS count
    FROM "ContactStat" GROUP BY 1 HAVING sum(count) > 0 ORDER BY 2 DESC, 1 LIMIT 10`;
  if (top.length === 0) return [];
  const ids = top.map((t) => t.id);
  // Último cadastro de cada um: uma busca no índice (createdById, createdAt desc) por pessoa.
  const [users, last] = await Promise.all([
    db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    db.$queryRaw<{ id: string; lastAt: Date | null }[]>`
      SELECT u.id, (SELECT max(c."createdAt") FROM "Contact" c WHERE c."createdById" = u.id) AS "lastAt"
      FROM unnest(${ids}::text[]) AS u(id)`,
  ]);
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const lastOf = new Map(last.map((l) => [l.id, l.lastAt]));
  return top.map((t) => ({ id: t.id, name: nameOf.get(t.id) ?? "—", count: t.count, lastAt: lastOf.get(t.id) ?? null }));
};

export const loadDashboard = async () => {
  const [totals, perDay, byOrigin, byState, byOperator, operators, pendingRequests, security, recent, phoneRegions] = await Promise.all([
    contactTotals(),
    contactsPerDay(14),
    contactsByOrigin(),
    contactsByState(),
    contactsByOperator(),
    db.user.count({ where: { role: "OPERATOR", status: "ACTIVE" } }),
    db.signupRequest.count({ where: { status: "PENDING" } }),
    securityLast24h(),
    db.contact.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 6,
      select: { id: true, name: true, city: true, state: true, createdAt: true, createdBy: { select: { name: true } } },
    }),
    loadPhoneRegions(),
  ]);

  return {
    totals,
    perDay,
    byOrigin,
    byState,
    byOperator,
    operators,
    pendingRequests,
    security,
    recent,
    phoneRegions,
    generatedAt: new Date(),
  };
};

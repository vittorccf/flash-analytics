// Janela fixa por chave, no Postgres: vale para todas as instâncias e sobrevive a reinício.
// Um único INSERT ... ON CONFLICT faz a contagem de forma atômica (requisições paralelas não escapam).
import { db } from "../db";

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export const consumeRateLimit = async (key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> => {
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, (now() AT TIME ZONE 'UTC') + make_interval(secs => ${windowSeconds}::int))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= (now() AT TIME ZONE 'UTC') THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= (now() AT TIME ZONE 'UTC') THEN EXCLUDED."resetAt" ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0]!;
  return {
    allowed: row.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000)),
  };
};

// Limites por caso de uso, num lugar só para revisar/ajustar.
export const LIMITS = {
  loginPerIp: { limit: 30, windowSeconds: 15 * 60 },
  // Só falhas contam (inclusive em e-mails que não existem, onde o bloqueio de conta não alcança).
  loginFailuresPerEmail: { limit: 10, windowSeconds: 15 * 60 },
  twoFactorPerIp: { limit: 20, windowSeconds: 15 * 60 },
  signupPerIp: { limit: 5, windowSeconds: 60 * 60 },
  // Checagem do e-mail enquanto a pessoa preenche a solicitação (consulta DNS).
  emailCheckPerIp: { limit: 40, windowSeconds: 15 * 60 },
  // Reautenticação dentro da conta (trocar senha, ligar/desligar 2FA): sessão roubada não testa senhas à vontade.
  reauthPerUser: { limit: 5, windowSeconds: 15 * 60 },
  // Busca de CEP: generoso para quem cadastra, mas impede usar o app como proxy aberto das APIs de CEP.
  zipLookupPerUser: { limit: 60, windowSeconds: 15 * 60 },
  // Exportação tira dado pessoal do sistema: folga para uso normal, freio para extração em massa.
  exportPerUser: { limit: 20, windowSeconds: 15 * 60 },
  importPerUser: { limit: 10, windowSeconds: 15 * 60 },
  supportPerUser: { limit: 5, windowSeconds: 60 * 60 },
} as const;

type LimitName = keyof typeof LIMITS;

export const consume = (name: LimitName, subject: string) =>
  consumeRateLimit(`${name}:${subject}`, LIMITS[name].limit, LIMITS[name].windowSeconds);

// Sem IP confiável (nenhum proxy configurado), o limite não some: vira um balde compartilhado,
// 10x mais folgado. Pior caso é lentidão para todos sob ataque, nunca ataque sem freio.
const NO_IP_FACTOR = 10;
export const consumeForIp = (name: "loginPerIp" | "twoFactorPerIp" | "signupPerIp" | "emailCheckPerIp", ip: string | null) =>
  ip
    ? consume(name, ip)
    : consumeRateLimit(`${name}:sem-ip`, LIMITS[name].limit * NO_IP_FACTOR, LIMITS[name].windowSeconds);

// Consulta sem contar: para limites que só somam falhas (login certo não pode gastar a cota do dono da conta).
export const isLimited = async (name: LimitName, subject: string) => {
  const bucket = await db.rateLimitBucket.findUnique({ where: { key: `${name}:${subject}` } });
  return Boolean(bucket && bucket.resetAt > new Date() && bucket.count >= LIMITS[name].limit);
};

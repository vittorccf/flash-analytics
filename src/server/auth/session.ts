// Sessões opacas no banco (não JWT): o cookie leva 256 bits aleatórios e o banco guarda só o SHA-256.
// Revogar é apagar a linha — desativar um usuário ou trocar a senha derruba as sessões na hora.
import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "../db";
import { generateToken, hashToken } from "../crypto";
import { env } from "../env";
import type { RequestMeta } from "../request-context";

import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS } from "./session-policy";

export { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS };
const TOUCH_EVERY_MS = 5 * 60 * 1000; // atualiza lastSeenAt no máximo a cada 5 min

// __Host-: só HTTPS, sem Domain, Path=/ — o navegador recusa o cookie vindo de subdomínio ou de http.
const prefix = env.cookieSecure ? "__Host-" : "";
export const SESSION_COOKIE = `${prefix}flash_session`;
export const CHALLENGE_COOKIE = `${prefix}flash_2fa`;
export const SIGNUP_WAIT_COOKIE = `${prefix}flash_signup`;

// SameSite=Strict: o cookie não vai em nenhuma requisição iniciada por outro site (CSRF), nem em links.
export const cookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: "strict" as const,
  path: "/",
  maxAge: maxAgeSeconds,
});

// cookies().delete() não manda Secure; com prefixo __Host- o navegador ignoraria a remoção.
export const clearCookie = async (name: string) => {
  (await cookies()).set(name, "", cookieOptions(0));
};

export const createSession = async (userId: string, meta: RequestMeta) => {
  // Login por cima de uma sessão aberta: a antiga deixa de valer (não fica órfã no banco).
  const previous = (await cookies()).get(SESSION_COOKIE)?.value;
  if (previous) await db.session.deleteMany({ where: { id: hashToken(previous) } });
  const token = generateToken();
  await db.session.create({
    data: {
      id: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_ABSOLUTE_MS),
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(SESSION_ABSOLUTE_MS / 1000));
};

export const isSessionExpired = (session: { expiresAt: Date; lastSeenAt: Date }, now = Date.now()) =>
  session.expiresAt.getTime() <= now || session.lastSeenAt.getTime() + SESSION_IDLE_MS <= now;

const sessionUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  mustChangePassword: true,
  totpEnabledAt: true,
  permissions: true,
} as const;

// touch=false: checagem de fundo (stream de tempo real) não conta como uso e não estende a sessão ociosa.
export const loadSessionByToken = async (token: string, { touch = true } = {}) => {
  const id = hashToken(token);
  const session = await db.session.findUnique({ where: { id }, include: { user: { select: sessionUserSelect } } });
  if (!session) return null;
  if (isSessionExpired(session) || session.user.status !== "ACTIVE") {
    await db.session.deleteMany({ where: { id } });
    return null;
  }
  if (touch && Date.now() - session.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await db.session.updateMany({ where: { id }, data: { lastSeenAt: new Date() } });
  }
  return session;
};

// Uma consulta por requisição, mesmo com layout + página + componentes pedindo a sessão.
// Refresh disparado pelo tempo real (cookie flash_rt, ver live-refresh.tsx) não renova a sessão ociosa.
export const getSession = cache(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  return loadSessionByToken(token, { touch: !store.has("flash_rt") });
});

export type CurrentSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;
export type SessionUser = CurrentSession["user"];

export const destroyCurrentSession = async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  await clearCookie(SESSION_COOKIE);
};

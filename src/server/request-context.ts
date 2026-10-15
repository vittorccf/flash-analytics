import "server-only";
import { headers } from "next/headers";
import { env } from "./env";

export type RequestMeta = { ip: string | null; userAgent: string | null };

// IP do cliente só vem de cabeçalho quando há um proxy confiável na frente. Usa o ÚLTIMO item do
// X-Forwarded-For: é o que o proxy confiável acrescentou (Nginx com $proxy_add_x_forwarded_for anexa
// ao que o cliente mandou; os primeiros itens são forjáveis). Na Vercel o cabeçalho tem um item só.
// Exposto direto (sem TRUSTED_IP_HEADER), o cabeçalho é ignorado.
export const requestMeta = async (): Promise<RequestMeta> => {
  const h = await headers();
  const forwarded = env.trustedIpHeader ? h.get(env.trustedIpHeader) : null;
  const ip = forwarded?.split(",").at(-1)?.trim().slice(0, 64) || null;
  return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
};

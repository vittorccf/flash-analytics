// Roda antes de toda requisição: cabeçalhos de segurança, CSP com nonce por requisição e um
// redirecionamento otimista para o login. NÃO é a checagem de acesso — essa fica em src/server/auth/dal.ts,
// em cada página/action/rota (o proxy pode ser contornado por mudança de matcher ou de rota).
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/admin", "/contatos", "/conta", "/notificacoes", "/design-system"];
const isDev = process.env.NODE_ENV === "development";
const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production";
const sessionCookie = `${secure ? "__Host-" : ""}flash_session`;

const buildCsp = (nonce: string) =>
  [
    "default-src 'self'",
    // strict-dynamic: só roda script com o nonce desta resposta (ou carregado por ele).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Sem 'unsafe-inline': nenhum style= sai do servidor (estilo dinâmico é aplicado pelo React no navegador, via
    // CSSOM, que a CSP permite). Em dev o overlay do Next injeta <style>, então lá o nonce não basta.
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(secure ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

const applySecurityHeaders = (headers: Headers) => {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "same-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (secure) headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    applySecurityHeaders(response.headers);
    response.headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    return response;
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !request.cookies.has(sessionCookie)) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    applySecurityHeaders(response.headers);
    return response;
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  applySecurityHeaders(response.headers);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

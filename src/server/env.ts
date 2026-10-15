// Configuração validada. Em produção, faltar segredo derruba a operação que precisa dele em vez de
// cair num padrão inseguro. Segredos são lidos no primeiro uso (não no import): o build roda sem eles.
import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";
const DEV_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

const schema = z.object({
  DATABASE_URL: z.string().optional(),
  DATABASE_URL_UNPOOLED: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  TRUSTED_IP_HEADER: z.string().optional(),
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
});

const parsed = schema.parse(process.env);

let encryptionKey: Buffer | null = null;

export const env = {
  isProduction,
  // LISTEN/NOTIFY não funciona atrás de pooler em modo transação: o tempo real usa a conexão direta.
  get listenDatabaseUrl() {
    const url = parsed.DATABASE_URL_UNPOOLED || parsed.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não definida.");
    return url;
  },
  get encryptionKey() {
    if (encryptionKey) return encryptionKey;
    const raw = parsed.ENCRYPTION_KEY || (isProduction ? "" : DEV_ENCRYPTION_KEY);
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) {
      throw new Error("ENCRYPTION_KEY ausente ou inválida: precisa ter 32 bytes em base64 (veja .env.example).");
    }
    return (encryptionKey = key);
  },
  // Atrás de um proxy confiável (Vercel/Nginx), o IP do cliente vem deste cabeçalho.
  trustedIpHeader: parsed.TRUSTED_IP_HEADER?.trim().toLowerCase() || null,
  // Cookies só via HTTPS em produção. COOKIE_SECURE=false apenas para testar o build local em http.
  cookieSecure: parsed.COOKIE_SECURE ? parsed.COOKIE_SECURE === "true" : isProduction,
};

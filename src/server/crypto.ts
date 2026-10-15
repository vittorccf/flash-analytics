// Primitivas de token e cifra. Tokens de sessão/espera são aleatórios (256 bits) e só o SHA-256
// vai para o banco: quem lê o banco não consegue se passar por ninguém.
import crypto from "node:crypto";

export const generateToken = () => crypto.randomBytes(32).toString("base64url");

export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const timingSafeEqualString = (a: string, b: string) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

// AES-256-GCM com IV aleatório. Formato versionado para permitir rotação de chave.
export const encryptSecret = (plain: string, key: Buffer) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
};

export const decryptSecret = (payload: string, key: Buffer) => {
  const [version, iv, tag, data] = payload.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Segredo cifrado em formato desconhecido.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
};

// Decifra sem estourar: chave trocada (ENCRYPTION_KEY diferente) ou dado corrompido viram null,
// e quem chama decide o que fazer em vez de derrubar a página.
export const tryDecryptSecret = (payload: string, key: Buffer) => {
  try {
    return decryptSecret(payload, key);
  } catch {
    console.error("[crypto] segredo não pôde ser decifrado (ENCRYPTION_KEY mudou?)");
    return null;
  }
};

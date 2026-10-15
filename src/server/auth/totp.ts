// TOTP (RFC 6238: SHA-1, 6 dígitos, passo de 30 s), compatível com Google/Microsoft Authenticator,
// 1Password etc. Implementação com node:crypto (mesma base do Salutti), sem dependência externa.
import crypto from "node:crypto";

const STEP = 30;
const DIGITS = 6;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const base32Encode = (buf: Buffer) => {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
};

export const base32Decode = (input: string) => {
  const clean = input.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error("base32 inválido");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
};

export const generateTotpSecret = () => base32Encode(crypto.randomBytes(20));

export const currentStep = (timeSeconds = Date.now() / 1000) => Math.floor(timeSeconds / STEP);

export const totpCodeForStep = (secret: string, step: number) => {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const bin = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return String(bin).padStart(DIGITS, "0");
};

// Aceita o passo atual e um antes/depois (relógio do celular adiantado/atrasado).
// Devolve o passo aceito, para o chamador recusar reuso do mesmo código; null se não confere.
export const matchTotp = (secret: string, code: string, timeSeconds = Date.now() / 1000): number | null => {
  if (!/^\d{6}$/.test(code)) return null;
  const now = currentStep(timeSeconds);
  for (const step of [now - 1, now, now + 1]) {
    const expected = totpCodeForStep(secret, step);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return step;
  }
  return null;
};

export const otpauthUrl = (secret: string, account: string, issuer = "Flash Contacts") =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`;

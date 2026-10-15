import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, generateToken, hashToken } from "@/server/crypto";
import { base32Decode, base32Encode, currentStep, matchTotp, totpCodeForStep } from "@/server/auth/totp";
import { burnPasswordCheck, generateTemporaryPassword, hashPassword, verifyPassword } from "@/server/auth/password";

describe("tokens", () => {
  it("são aleatórios, com 256 bits, e o hash é determinístico", () => {
    const a = generateToken();
    expect(a).not.toBe(generateToken());
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("cifra de segredos (AES-256-GCM)", () => {
  const key = crypto.randomBytes(32);

  it("cifra e decifra, com IV diferente a cada vez", () => {
    const a = encryptSecret("SEGREDO", key);
    expect(a).not.toBe(encryptSecret("SEGREDO", key));
    expect(decryptSecret(a, key)).toBe("SEGREDO");
  });

  it("recusa texto adulterado ou chave errada", () => {
    const payload = encryptSecret("SEGREDO", key);
    const parts = payload.split(":");
    parts[3] = Buffer.from("XXXXXXX").toString("base64");
    expect(() => decryptSecret(parts.join(":"), key)).toThrow();
    expect(() => decryptSecret(payload, crypto.randomBytes(32))).toThrow();
  });
});

describe("TOTP (RFC 6238)", () => {
  it("bate com o vetor de teste da RFC (SHA-1, T=59s)", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    // RFC 6238, apêndice B: 94287082 (8 dígitos) → 6 dígitos finais.
    expect(totpCodeForStep(secret, Math.floor(59 / 30))).toBe("287082");
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
  });

  it("aceita uma janela de ±30 s e devolve o passo usado", () => {
    const secret = base32Encode(crypto.randomBytes(20));
    const now = 1_700_000_000;
    const step = currentStep(now);
    expect(matchTotp(secret, totpCodeForStep(secret, step), now)).toBe(step);
    expect(matchTotp(secret, totpCodeForStep(secret, step - 1), now)).toBe(step - 1);
    expect(matchTotp(secret, totpCodeForStep(secret, step + 3), now)).toBeNull();
    expect(matchTotp(secret, "12345", now)).toBeNull();
  });
});

describe("senhas (argon2id)", () => {
  it("gera hash argon2id e verifica", async () => {
    const hash = await hashPassword("uma frase longa de teste");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, "uma frase longa de teste")).toBe(true);
    expect(await verifyPassword(hash, "outra")).toBe(false);
    expect(await verifyPassword("lixo", "x")).toBe(false);
    await expect(burnPasswordCheck("x")).resolves.toBeUndefined();
  });

  it("senha provisória tem 16 caracteres seguros para URL", () => {
    expect(generateTemporaryPassword()).toMatch(/^[A-Za-z0-9_-]{16}$/);
  });
});

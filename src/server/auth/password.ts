// argon2id com os parâmetros mínimos recomendados pela OWASP (19 MiB, 2 iterações, 1 thread).
import crypto from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string) => hash(password, OPTIONS);

export const verifyPassword = async (passwordHash: string, password: string) => {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
};

// E-mail inexistente custa o mesmo tempo que senha errada: o tempo de resposta não revela quais contas existem.
let dummyHash: Promise<string> | null = null;
export const burnPasswordCheck = async (password: string) => {
  dummyHash ??= hashPassword(crypto.randomBytes(16).toString("hex"));
  await verifyPassword(await dummyHash, password);
};

// Senha provisória criada pelo admin: 16 caracteres aleatórios (~96 bits), exibida uma única vez.
export const generateTemporaryPassword = () => crypto.randomBytes(12).toString("base64url");

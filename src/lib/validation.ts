// Esquemas de entrada (zod). Toda Server Action valida aqui antes de tocar no banco;
// o formulário usa as mesmas regras para mostrar o erro ao lado do campo.
import { z } from "zod";
import { ORIGINS, UFS } from "./labels";
import { PASSWORD_MAX, passwordProblem } from "./password-policy";
import { isValidBrPhone, normalizePhone } from "./phone";
import { isValidZipCode, normalizeZipCode } from "./zip-code";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "E-mail longo demais.")
  .pipe(z.email("Informe um e-mail válido."));

const personName = z
  .string()
  .trim()
  .min(3, "Informe o nome completo.")
  .max(120, "Nome longo demais.")
  // Letras (com acento), espaço, apóstrofo, hífen e ponto.
  .regex(/^[\p{L}][\p{L}' .-]*$/u, "Use apenas letras no nome.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .optional()
    .transform((v) => (v ? v : null));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha.").max(PASSWORD_MAX),
});

export const totpCodeSchema = z.object({
  code: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "O código tem 6 dígitos.")),
});

const withPasswordPolicy = <T extends { password: string; confirm: string; email?: string; name?: string }>(
  data: T,
  ctx: z.RefinementCtx,
) => {
  const problem = passwordProblem(data.password, { email: data.email, name: data.name });
  if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
  if (data.password !== data.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "As senhas não conferem." });
};

export const signupSchema = z
  .object({
    name: personName,
    email,
    password: z.string().max(PASSWORD_MAX),
    confirm: z.string().max(PASSWORD_MAX),
  })
  .superRefine(withPasswordPolicy);

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Informe a senha atual.").max(PASSWORD_MAX),
    password: z.string().max(PASSWORD_MAX),
    confirm: z.string().max(PASSWORD_MAX),
    // Vêm da sessão (não do formulário), só para a regra "senha não pode conter seu nome/e-mail".
    email: z.string().optional(),
    name: z.string().optional(),
  })
  .superRefine(withPasswordPolicy);

export const createUserSchema = z.object({
  name: personName,
  email,
  role: z.enum(["ADMIN", "OPERATOR"], "Escolha o perfil."),
});

export const contactSchema = z.object({
  name: personName,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .transform((v) => (v === "" ? null : v))
    .pipe(z.email("Informe um e-mail válido.").nullable()),
  phone: z
    .string()
    .max(30)
    .transform(normalizePhone)
    .refine(isValidBrPhone, "Informe um telefone com DDD, ex.: (11) 91234-5678."),
  // "" = não informado (a tela deduz pelo tipo de número), "true"/"false" = informado.
  whatsapp: z
    .enum(["", "true", "false"], "Escolha uma opção de WhatsApp.")
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : null)),
  company: optionalText(120),
  zipCode: z
    .string()
    .max(20)
    .optional()
    .transform((v) => normalizeZipCode(v ?? ""))
    .refine((v) => v === "" || isValidZipCode(v), "Informe um CEP com 8 dígitos.")
    .transform((v) => (v === "" ? null : v)),
  street: optionalText(150),
  number: optionalText(20),
  district: optionalText(100),
  city: z.string().trim().min(2, "Informe a cidade.").max(80, "Cidade longa demais."),
  state: z.enum(UFS, "Escolha a UF."),
  origin: z.enum(ORIGINS as [string, ...string[]], "Escolha a origem.").transform((v) => v as (typeof ORIGINS)[number]),
  notes: optionalText(500),
});

export type ContactInput = z.infer<typeof contactSchema>;

// Erros por campo para o formulário (primeira mensagem de cada campo).
export type FieldErrors = Record<string, string>;

export const fieldErrors = (error: z.ZodError): FieldErrors => {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
};

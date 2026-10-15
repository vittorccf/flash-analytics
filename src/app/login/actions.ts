"use server";

import { redirect } from "next/navigation";
import { authenticate, completeTwoFactor } from "@/server/auth/login";
import { homeFor } from "@/server/auth/dal";
import { clearCookie, SIGNUP_WAIT_COOKIE } from "@/server/auth/session";
import { db } from "@/server/db";
import { requestMeta } from "@/server/request-context";
import { consumeForIp } from "@/server/auth/rate-limit";
import { emailProblem } from "@/server/email-check";
import { createSignupRequest } from "@/server/signup-requests";
import { fieldErrors, loginSchema, signupSchema, totpCodeSchema, type FieldErrors } from "@/lib/validation";

export type LoginState = { error?: string; email?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const email = String(formData.get("email") ?? "").slice(0, 254);
  if (!parsed.success) return { error: "Informe e-mail e senha.", email };

  const outcome = await authenticate(parsed.data.email, parsed.data.password, await requestMeta());
  if (outcome.status === "error") return { error: outcome.message, email };
  if (outcome.status === "two_factor_required") redirect("/login/verificar");

  await clearCookie(SIGNUP_WAIT_COOKIE);
  const user = await db.user.findUniqueOrThrow({ where: { id: outcome.userId }, select: { role: true, mustChangePassword: true } });
  redirect(user.mustChangePassword ? "/conta/senha" : homeFor(user));
}

// Devolve nome e e-mail para o formulário não perder o que foi digitado (senhas nunca voltam).
export type SignupState = {
  errors?: FieldErrors;
  error?: string;
  values?: { name: string; email: string };
  submitted?: { name: string; email: string };
};

export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  const values = { name: String(formData.get("name") ?? "").slice(0, 120), email: String(formData.get("email") ?? "").slice(0, 254) };
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const outcome = await createSignupRequest(parsed.data, await requestMeta());
  if (!outcome.ok) return outcome.field ? { errors: { [outcome.field]: outcome.message }, values } : { error: outcome.message, values };
  return { submitted: { name: parsed.data.name, email: parsed.data.email } };
}

// Conferência do e-mail ao sair do campo (antes de enviar). Pública como a própria solicitação, então tem limite
// por IP; passado o limite, não acusa nada aqui: o envio confere de novo de qualquer forma.
export async function checkSignupEmailAction(value: string): Promise<string | null> {
  const parsed = signupSchema.shape.email.safeParse(value);
  if (!parsed.success) return null; // formato inválido: a regra do navegador já mostra
  if (!(await consumeForIp("emailCheckPerIp", (await requestMeta()).ip)).allowed) return null;
  return emailProblem(parsed.data);
}

export async function dismissSignupAction() {
  await clearCookie(SIGNUP_WAIT_COOKIE);
}

export type TwoFactorState = { error?: string };

export async function verifyTwoFactorAction(_prev: TwoFactorState, formData: FormData): Promise<TwoFactorState> {
  const parsed = totpCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "O código tem 6 dígitos." };

  const outcome = await completeTwoFactor(parsed.data.code, await requestMeta());
  if (outcome.status !== "authenticated") return { error: outcome.status === "error" ? outcome.message : "Tente de novo." };

  await clearCookie(SIGNUP_WAIT_COOKIE);
  const user = await db.user.findUniqueOrThrow({ where: { id: outcome.userId }, select: { role: true, mustChangePassword: true } });
  redirect(user.mustChangePassword ? "/conta/senha" : homeFor(user));
}

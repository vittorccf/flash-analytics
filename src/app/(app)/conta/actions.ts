"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { homeFor, requireUser } from "@/server/auth/dal";
import { getSession } from "@/server/auth/session";
import { requestMeta } from "@/server/request-context";
import { changeOwnPassword, confirmTwoFactorEnrollment, disableOwnTwoFactor, revokeOtherSessions } from "@/server/users";
import { changePasswordSchema, fieldErrors, totpCodeSchema, type FieldErrors } from "@/lib/validation";

export type PasswordState = { errors?: FieldErrors; error?: string; done?: boolean };

export async function changePasswordAction(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const user = await requireUser({ allowPendingPasswordChange: true });
  const session = (await getSession())!;
  const parsed = changePasswordSchema.safeParse({
    current: formData.get("current"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    email: user.email,
    name: user.name,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const outcome = await changeOwnPassword(user.id, session.id, parsed.data.current, parsed.data.password, await requestMeta());
  if (!outcome.ok) return { errors: { current: outcome.message } };
  if (user.mustChangePassword) {
    // O layout (menu, tempo real) foi montado no modo "senha provisória": precisa ser refeito, não só a página.
    revalidatePath("/", "layout");
    redirect(homeFor(user));
  }
  return { done: true };
}

export type TwoFactorState = { error?: string };

export async function confirmTwoFactorAction(_prev: TwoFactorState, formData: FormData): Promise<TwoFactorState> {
  const user = await requireUser();
  const parsed = totpCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "O código tem 6 dígitos." };
  const password = z.string().min(1).max(128).safeParse(formData.get("password"));
  if (!password.success) return { error: "Informe a sua senha." };
  const outcome = await confirmTwoFactorEnrollment(user.id, password.data, parsed.data.code, await requestMeta());
  if (!outcome.ok) return { error: outcome.message };
  revalidatePath("/conta");
  return {};
}

export async function disableTwoFactorAction(_prev: TwoFactorState, formData: FormData): Promise<TwoFactorState> {
  const user = await requireUser();
  const password = z.string().min(1).max(128).safeParse(formData.get("password"));
  if (!password.success) return { error: "Informe a sua senha." };
  const outcome = await disableOwnTwoFactor(user.id, password.data, await requestMeta());
  if (!outcome.ok) return { error: outcome.message };
  revalidatePath("/conta");
  return {};
}

export async function revokeOtherSessionsAction() {
  const user = await requireUser();
  const session = (await getSession())!;
  await revokeOtherSessions(user.id, session.id, await requestMeta());
  revalidatePath("/conta");
}

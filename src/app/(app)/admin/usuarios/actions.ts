"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/dal";
import { requestMeta } from "@/server/request-context";
import { createUserByAdmin, resetUserPassword, resetUserTwoFactor, setUserStatus } from "@/server/users";
import { createUserSchema, fieldErrors, type FieldErrors } from "@/lib/validation";

export type CreateUserState = {
  errors?: FieldErrors;
  error?: string;
  values?: Record<string, string>;
  created?: { name: string; email: string; temporaryPassword: string };
};

export async function createUserAction(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const admin = await requireAdmin();
  const raw = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? ""), role: String(formData.get("role") ?? "") };
  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  const outcome = await createUserByAdmin(parsed.data, admin.id, await requestMeta());
  if (!outcome.ok) return { error: outcome.message, values: raw };
  revalidatePath("/admin/usuarios");
  return { created: { name: parsed.data.name, email: parsed.data.email, temporaryPassword: outcome.value.temporaryPassword } };
}

export type UserActionState = { error?: string; temporaryPassword?: string; done?: string };

const userActionSchema = z.object({
  userId: z.string().min(1).max(40),
  op: z.enum(["disable", "enable", "reset_password", "reset_2fa"]),
});

export async function userAction(_prev: UserActionState, formData: FormData): Promise<UserActionState> {
  const admin = await requireAdmin();
  const parsed = userActionSchema.safeParse({ userId: formData.get("userId"), op: formData.get("op") });
  if (!parsed.success) return { error: "Requisição inválida." };
  const { userId, op } = parsed.data;
  const meta = await requestMeta();

  if (op === "reset_password") {
    const outcome = await resetUserPassword(userId, admin.id, meta);
    if (!outcome.ok) return { error: outcome.message };
    revalidatePath("/admin/usuarios");
    return { temporaryPassword: outcome.value.temporaryPassword };
  }

  const outcome =
    op === "reset_2fa"
      ? await resetUserTwoFactor(userId, admin.id, meta)
      : await setUserStatus(userId, op === "disable" ? "DISABLED" : "ACTIVE", admin.id, meta);
  if (!outcome.ok) return { error: outcome.message };
  revalidatePath("/admin/usuarios");
  return { done: op === "reset_2fa" ? "2FA removido." : op === "disable" ? "Usuário desativado e desconectado." : "Usuário reativado." };
}

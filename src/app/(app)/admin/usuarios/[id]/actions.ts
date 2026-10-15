"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/dal";
import { requestMeta } from "@/server/request-context";
import { deleteUserByAdmin, updateUserByAdmin } from "@/server/user-admin";
import { sanitizePermissions } from "@/lib/permissions";
import { createUserSchema, fieldErrors, type FieldErrors } from "@/lib/validation";

export type EditUserState = { errors?: FieldErrors; error?: string; values?: Record<string, string>; saved?: boolean };

const idSchema = z.string().min(1).max(40);

export async function updateUserAction(id: string, _prev: EditUserState, formData: FormData): Promise<EditUserState> {
  const admin = await requireAdmin();
  const userId = idSchema.parse(id);
  const raw = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? ""), role: String(formData.get("role") ?? "") };
  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const permissions = sanitizePermissions(formData.getAll("permissions"));
  const outcome = await updateUserByAdmin(userId, { ...parsed.data, permissions }, admin.id, await requestMeta());
  if (!outcome.ok) return { error: outcome.message, values: raw };
  return { saved: true, values: raw };
}

export type DeleteUserState = { error?: string };

export async function deleteUserAction(id: string): Promise<DeleteUserState> {
  const admin = await requireAdmin();
  const outcome = await deleteUserByAdmin(idSchema.parse(id), admin.id, await requestMeta());
  if (!outcome.ok) return { error: outcome.message };
  redirect("/admin/usuarios?aviso=excluido");
}

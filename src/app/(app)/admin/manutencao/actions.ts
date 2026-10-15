"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/dal";
import { consume } from "@/server/auth/rate-limit";
import { verifyPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { DEMO_MAX, RESET_SCOPES, resetData, runCleanup, seedDemoContacts, type ResetScope } from "@/server/maintenance";
import { requestMeta } from "@/server/request-context";

export type MaintenanceState = { error?: string; message?: string };

export async function runCleanupAction(): Promise<MaintenanceState> {
  const admin = await requireAdmin();
  const removed = await runCleanup("admin", admin.id);
  const total = Object.values(removed).reduce((a, b) => a + b, 0);
  return { message: total ? `Limpeza feita: ${total} registro(s) vencido(s) removido(s).` : "Nada para limpar: a base já estava em dia." };
}

export async function seedDemoAction(_prev: MaintenanceState, formData: FormData): Promise<MaintenanceState> {
  const admin = await requireAdmin();
  const count = z.coerce.number().int().min(1).max(DEMO_MAX).safeParse(formData.get("count"));
  if (!count.success) return { error: `Informe uma quantidade entre 1 e ${DEMO_MAX}.` };
  try {
    const created = await seedDemoContacts(admin.id, count.data, await requestMeta());
    revalidatePath("/", "layout");
    return { message: `${created} contato(s) de teste criados.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível gerar os dados." };
  }
}

// Limpar a base: senha do admin + digitar LIMPAR + escopo escolhido. Ação rara e destrutiva: dupla confirmação.
export async function resetDataAction(_prev: MaintenanceState, formData: FormData): Promise<MaintenanceState> {
  const admin = await requireAdmin();
  if (formData.get("confirmation") !== "LIMPAR") return { error: 'Digite LIMPAR (em maiúsculas) para confirmar.' };
  const scopes = formData.getAll("scope").filter((s): s is ResetScope => typeof s === "string" && s in RESET_SCOPES);
  if (!scopes.length) return { error: "Escolha o que limpar." };
  if (!(await consume("reauthPerUser", admin.id)).allowed) return { error: "Muitas tentativas. Aguarde alguns minutos." };
  const user = await db.user.findUnique({ where: { id: admin.id }, select: { passwordHash: true } });
  const password = String(formData.get("password") ?? "").slice(0, 128);
  if (!user || !(await verifyPassword(user.passwordHash, password))) return { error: "Senha incorreta." };
  try {
    const removed = await resetData(admin.id, scopes, await requestMeta());
    revalidatePath("/", "layout");
    const summary = Object.entries(removed).map(([k, n]) => `${RESET_SCOPES[k as ResetScope]}: ${n}`).join(" · ");
    return { message: `Base limpa. ${summary}` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível limpar." };
  }
}

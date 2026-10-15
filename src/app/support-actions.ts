"use server";

import { z } from "zod";
import { getCurrentUser } from "@/server/auth/dal";
import { requestMeta } from "@/server/request-context";
import { createSupportTicket } from "@/server/support";
import { SUPPORT_TYPES, type SupportType } from "@/lib/support";

export type SupportState = {
  error?: string;
  sent?: { protocol: string; whatsapp: string; email: string };
};

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const schema = z.object({
  type: z.enum(Object.keys(SUPPORT_TYPES) as [SupportType, ...SupportType[]], "Escolha o tipo de problema."),
  message: z.string().trim().min(10, "Conte um pouco mais (mínimo de 10 caracteres).").max(2000, "Máximo de 2.000 caracteres."),
  // Caminho da tela onde a pessoa estava (ajuda a reproduzir). Só caminhos internos.
  page: z
    .string()
    .max(200)
    .optional()
    .transform((v) => (v && v.startsWith("/") ? v : null)),
  name: optional(120),
  replyTo: optional(254),
});

// Aberto também para quem não está logado (tela de login): por isso o limite por IP no caso de uso.
export async function sendSupportAction(_prev: SupportState, formData: FormData): Promise<SupportState> {
  const user = await getCurrentUser();
  const parsed = schema.safeParse({
    type: formData.get("type"),
    message: formData.get("message"),
    page: formData.get("page") ?? undefined,
    name: formData.get("name") ?? undefined,
    replyTo: formData.get("replyTo") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  if (!user && !parsed.data.replyTo) return { error: "Deixe um e-mail ou telefone para o suporte responder." };

  const result = await createSupportTicket(user, parsed.data, await requestMeta());
  if (!result.ok) return { error: result.message };
  return { sent: { protocol: result.protocol, whatsapp: result.links.whatsapp, email: result.links.email } };
}

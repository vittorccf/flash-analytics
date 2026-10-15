"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/dal";
import { requestMeta } from "@/server/request-context";
import { approveSignupRequest, rejectSignupRequest } from "@/server/signup-requests";

export type DecisionState = { error?: string };

const schema = z.object({
  id: z.string().min(1).max(40),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(200).optional(),
});

export async function decideSignupAction(_prev: DecisionState, formData: FormData): Promise<DecisionState> {
  const admin = await requireAdmin();
  const parsed = schema.safeParse({
    id: formData.get("id"),
    decision: formData.get("decision"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) return { error: "Requisição inválida." };

  const meta = await requestMeta();
  const outcome =
    parsed.data.decision === "approve"
      ? await approveSignupRequest(parsed.data.id, admin.id, meta)
      : await rejectSignupRequest(parsed.data.id, admin.id, parsed.data.note || null, meta);
  if (!outcome.ok) return { error: outcome.message };
  revalidatePath("/admin/solicitacoes");
  return {};
}

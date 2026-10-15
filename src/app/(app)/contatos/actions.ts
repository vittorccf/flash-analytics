"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/dal";
import { quickSearchContacts, toggleFavorite } from "@/server/contacts";

// Favorito é pessoal: não muda nada para os outros, então não gera evento de tempo real nem auditoria.
export async function toggleFavoriteAction(contactId: string): Promise<boolean | null> {
  const user = await requireUser();
  const result = await toggleFavorite(user, z.string().min(1).max(40).parse(contactId));
  revalidatePath("/contatos");
  return result;
}

// Busca do topo da tela. Só no que a pessoa enxerga; mínimo de 2 caracteres.
export async function quickSearchAction(query: string) {
  const user = await requireUser();
  const q = String(query ?? "").trim().slice(0, 100);
  if (q.length < 2) return [];
  return quickSearchContacts(user, q);
}

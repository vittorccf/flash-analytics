"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireUser } from "@/server/auth/dal";
import { addNote, deleteContact, deleteNote } from "@/server/contacts";
import { removeContactPhoto, setContactPhoto, PHOTO_MAX_BYTES } from "@/server/contact-photos";
import { requestMeta } from "@/server/request-context";
import type { PhotoState } from "@/components/photo-form";

const idSchema = z.string().min(1).max(40);

// Excluir: só com a permissão "Apagar" e só contatos que a pessoa enxerga (regra em deleteContact).
export async function deleteContactAction(id: string) {
  const user = await requirePermission("contacts.delete");
  if (!(await deleteContact(user, idSchema.parse(id), await requestMeta()))) notFound();
  redirect("/contatos?aviso=excluido");
}

export type NoteState = { error?: string; ok?: boolean };

const noteSchema = z.string().trim().min(1, "Escreva a nota.").max(2000, "A nota pode ter no máximo 2.000 caracteres.");

export async function addNoteAction(contactId: string, _prev: NoteState, formData: FormData): Promise<NoteState> {
  const user = await requirePermission("contacts.edit");
  const body = noteSchema.safeParse(formData.get("body"));
  if (!body.success) return { error: body.error.issues[0]!.message };
  const id = idSchema.parse(contactId);
  if (!(await addNote(user, id, body.data, await requestMeta()))) notFound();
  revalidatePath(`/contatos/${id}`);
  return { ok: true };
}

export async function deleteNoteAction(noteId: string, contactId: string) {
  const user = await requireUser();
  await deleteNote(user, idSchema.parse(noteId), await requestMeta());
  revalidatePath(`/contatos/${idSchema.parse(contactId)}`);
}

// Foto do contato: quem pode editar o contato troca ou remove (regras em src/server/contact-photos.ts).
export async function uploadContactPhotoAction(contactId: string, _prev: PhotoState, formData: FormData): Promise<PhotoState> {
  const user = await requirePermission("contacts.edit");
  const id = idSchema.parse(contactId);
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha uma imagem." };
  if (file.size > PHOTO_MAX_BYTES) return { error: "A foto pode ter no máximo 1 MB." };
  const error = await setContactPhoto(user, id, Buffer.from(await file.arrayBuffer()), await requestMeta());
  if (error) return { error };
  revalidatePath(`/contatos/${id}`);
  revalidatePath("/contatos");
  return { done: true };
}

export async function removeContactPhotoAction(contactId: string) {
  const user = await requirePermission("contacts.edit");
  const id = idSchema.parse(contactId);
  await removeContactPhoto(user, id, await requestMeta());
  revalidatePath(`/contatos/${id}`);
  revalidatePath("/contatos");
}

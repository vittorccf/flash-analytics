"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireUser } from "@/server/auth/dal";
import { consume } from "@/server/auth/rate-limit";
import { createContact, findDuplicates, updateContact } from "@/server/contacts";
import { requestMeta } from "@/server/request-context";
import { lookupZipCode, type ZipCodeResult } from "@/server/zip-code-lookup";
import { can } from "@/lib/permissions";
import { contactSchema, fieldErrors, type FieldErrors } from "@/lib/validation";
import { isValidZipCode, normalizeZipCode } from "@/lib/zip-code";

export type DuplicateHint = { id: string; name: string; phone: string; email: string | null };
export type ContactFormState = { errors?: FieldErrors; values?: Record<string, string>; duplicates?: DuplicateHint[] };

const FIELDS = ["name", "email", "phone", "whatsapp", "company", "zipCode", "street", "number", "district", "city", "state", "origin", "notes"] as const;

const readForm = (formData: FormData) => {
  const raw = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "")]));
  return { raw, parsed: contactSchema.safeParse(raw), confirmed: formData.get("confirmDuplicate") === "1" };
};

// Autorização dentro de cada action: elas são endpoints POST públicos, com ou sem a página na frente.
export async function createContactAction(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const user = await requirePermission("contacts.create");
  const { raw, parsed, confirmed } = readForm(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  // Duplicado (mesmo telefone ou e-mail): avisa e só salva se a pessoa confirmar.
  if (!confirmed) {
    const duplicates = await findDuplicates(user, parsed.data);
    if (duplicates.length) return { values: raw, duplicates };
  }
  await createContact(user, parsed.data, await requestMeta());
  redirect("/contatos?aviso=criado");
}

const idSchema = z.string().min(1).max(40);

// O id vem "amarrado" (bind) pelo servidor, mas chega pelo cliente: é validado e a visibilidade é conferida de novo.
export async function updateContactAction(id: string, _prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const user = await requirePermission("contacts.edit");
  const contactId = idSchema.parse(id);
  const { raw, parsed, confirmed } = readForm(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  if (!confirmed) {
    const duplicates = await findDuplicates(user, parsed.data, contactId);
    if (duplicates.length) return { values: raw, duplicates };
  }
  if (!(await updateContact(user, contactId, parsed.data, await requestMeta()))) notFound();
  redirect(`/contatos/${contactId}?aviso=editado`);
}

export type ZipCodeLookupState = ZipCodeResult | { status: "invalid" } | { status: "limited" };

// Preenchimento automático do endereço, para quem cria ou edita contatos, com limite por usuário.
export async function lookupZipCodeAction(input: string): Promise<ZipCodeLookupState> {
  const user = await requireUser();
  if (!can(user, "contacts.create") && !can(user, "contacts.edit")) return { status: "unavailable" };
  const zipCode = normalizeZipCode(String(input ?? "").slice(0, 20));
  if (!isValidZipCode(zipCode)) return { status: "invalid" };
  if (!(await consume("zipLookupPerUser", user.id)).allowed) return { status: "limited" };
  return lookupZipCode(zipCode);
}

"use server";

import { requirePermission } from "@/server/auth/dal";
import { consume } from "@/server/auth/rate-limit";
import { IMPORT_MAX_BYTES, importContacts, type ImportReport } from "@/server/contact-import";
import { requestMeta } from "@/server/request-context";

export type ImportState = { report?: ImportReport; error?: string };

export async function importContactsAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requirePermission("contacts.create");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha um arquivo .xlsx ou .csv." };
  if (file.size > IMPORT_MAX_BYTES) return { error: "Arquivo maior que 2 MB. Divida a planilha em partes." };
  if (!(await consume("importPerUser", user.id)).allowed) return { error: "Muitas importações seguidas. Aguarde alguns minutos." };

  const mode = formData.get("mode") === "valid" ? "valid" : "all";
  const report = await importContacts(
    user,
    { name: file.name.slice(0, 200), bytes: Buffer.from(await file.arrayBuffer()) },
    mode,
    await requestMeta(),
  );
  return { report };
}

// Cartão de contato (.vcf, vCard 3.0) para salvar na agenda do celular ou do Outlook.
// É dado pessoal saindo do sistema: exige a permissão "Exportar" e fica na auditoria.
import { recordAudit } from "@/server/audit";
import { requireUser } from "@/server/auth/dal";
import { getContact } from "@/server/contacts";
import { db } from "@/server/db";
import { requestMeta } from "@/server/request-context";
import { toE164 } from "@/lib/contact-channels";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// vCard: vírgula, ponto e vírgula, barra e quebra de linha precisam de escape.
const esc = (v: string | null | undefined) => (v ?? "").replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "contacts.export")) return new Response("Sem permissão para exportar.", { status: 403 });
  const { id } = await params;
  const contact = await getContact(user, id.slice(0, 40));
  if (!contact) return new Response("Não encontrado", { status: 404 });

  const [first, ...rest] = contact.name.split(" ");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${esc(contact.name)}`,
    `N:${esc(rest.join(" "))};${esc(first)};;;`,
    `TEL;TYPE=${contact.phone.length === 11 ? "CELL" : "WORK"}:${toE164(contact.phone)}`,
    contact.email ? `EMAIL;TYPE=INTERNET:${esc(contact.email)}` : null,
    contact.company ? `ORG:${esc(contact.company)}` : null,
    `ADR;TYPE=WORK:;;${esc([contact.street, contact.number].filter(Boolean).join(", "))};${esc(contact.city)};${esc(contact.state)};${esc(contact.zipCode)};Brasil`,
    "END:VCARD",
  ].filter(Boolean);

  await recordAudit(db, { actorId: user.id, action: "contact.vcard_exported", entity: "Contact", entityId: contact.id, meta: await requestMeta() });

  const slug = contact.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug || "contato"}.vcf"`,
      "Cache-Control": "no-store, private",
    },
  });
}

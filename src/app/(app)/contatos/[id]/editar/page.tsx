import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/dal";
import { getContact } from "@/server/contacts";
import { Card, PageHeader } from "@/components/ui";
import { updateContactAction } from "../../_form/actions";
import { ContactForm } from "../../_form/contact-form";

export const metadata: Metadata = { title: "Editar contato" };

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("contacts.edit");
  const { id } = await params;
  const contact = await getContact(user, id.slice(0, 40));
  if (!contact) notFound();

  // Valores atuais como texto, no mesmo formato que o formulário envia.
  const initial: Record<string, string> = {
    name: contact.name,
    phone: contact.phone,
    whatsapp: contact.whatsapp === null ? "" : String(contact.whatsapp),
    email: contact.email ?? "",
    company: contact.company ?? "",
    zipCode: contact.zipCode ?? "",
    street: contact.street ?? "",
    number: contact.number ?? "",
    district: contact.district ?? "",
    city: contact.city,
    state: contact.state,
    origin: contact.origin,
    notes: contact.notes ?? "",
  };

  return (
    <>
      <PageHeader title="Editar contato" description={contact.name} />
      <Card className="max-w-2xl p-6">
        <ContactForm
          action={updateContactAction.bind(null, contact.id)}
          initial={initial}
          submitLabel="Salvar alterações"
          cancelHref={`/contatos/${contact.id}`}
        />
      </Card>
    </>
  );
}

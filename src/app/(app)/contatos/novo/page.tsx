import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/dal";
import { Card, PageHeader } from "@/components/ui";
import { createContactAction } from "../_form/actions";
import { ContactForm } from "../_form/contact-form";

export const metadata: Metadata = { title: "Novo contato" };

export default async function NewContactPage() {
  // Operador e admin cadastram contatos; os demais admins são avisados em tempo real.
  const user = await requirePermission("contacts.create");
  return (
    <>
      <PageHeader
        title="Novo contato"
        description={user.role === "ADMIN" ? "Os outros administradores são avisados na hora em que você salvar." : "Os administradores são avisados na hora em que você salvar."}
      />
      <Card className="max-w-2xl p-6">
        <ContactForm action={createContactAction} />
      </Card>
    </>
  );
}

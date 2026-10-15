import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireUser } from "@/server/auth/dal";
import { contactHistory, getContact, listNotes } from "@/server/contacts";
import { whatsappAvailability } from "@/lib/contact-channels";
import { locatePhone } from "@/lib/ddd";
import { formatDateTime } from "@/lib/format";
import { auditLabel, CONTACT_FIELD_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { formatZipCode } from "@/lib/zip-code";
import { Avatar, ContactAvatar } from "@/components/avatar";
import { PhotoForm } from "@/components/photo-form";
import { EmailChannels, PhoneChannels } from "@/components/contact-channels";
import { FavoriteButton } from "@/components/favorite-button";
import { LiveRefresh } from "@/components/realtime/live-refresh";
import { OriginTag } from "@/components/origin-tag";
import { Alert, Card, CardHeader, PageHeader, buttonClass } from "@/components/ui";
import { removeContactPhotoAction, uploadContactPhotoAction } from "./actions";
import { DeleteContact } from "./delete-contact";
import { NotesPanel } from "./notes-panel";
import { ShareContact } from "./share-contact";

export const metadata: Metadata = { title: "Contato" };

const Item = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid gap-1 px-5 py-3 sm:grid-cols-[10rem_1fr]">
    <dt className="text-sm text-muted">{label}</dt>
    <dd className="text-sm text-foreground">{children ?? <span className="text-muted">—</span>}</dd>
  </div>
);

export default async function ContactPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  // Contato que a pessoa não enxerga responde 404, igual a um id inexistente.
  const contact = await getContact(user, id.slice(0, 40));
  if (!contact) notFound();
  const [{ aviso }, notes, history] = await Promise.all([searchParams, listNotes(contact.id), contactHistory(contact.id)]);

  const origin = locatePhone(contact.phone);
  const wa = whatsappAvailability(contact.phone, contact.whatsapp);
  const address = [
    [contact.street, contact.number].filter(Boolean).join(", "),
    contact.district,
    `${contact.city}/${contact.state}`,
    contact.zipCode ? `CEP ${formatZipCode(contact.zipCode)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <LiveRefresh events={["contact.updated"]} />
      <Link href="/contatos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Contatos
      </Link>
      <div className="flex items-start gap-4">
        <ContactAvatar id={contact.id} name={contact.name} photoVersion={contact.photo?.updatedAt} size={56} className="mt-1" />
        <div className="min-w-0 flex-1">
          <PageHeader
            title={contact.name}
            description={contact.company ?? undefined}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <FavoriteButton contactId={contact.id} name={contact.name} initial={contact.favoritedBy.length > 0} />
                <ShareContact id={contact.id} name={contact.name} canExport={can(user, "contacts.export")} />
                {can(user, "contacts.edit") ? (
                  <Link href={`/contatos/${contact.id}/editar`} className={buttonClass("secondary")}>
                    <Pencil className="size-4" aria-hidden /> Editar
                  </Link>
                ) : null}
                {can(user, "contacts.delete") ? <DeleteContact id={contact.id} name={contact.name} /> : null}
              </div>
            }
          />
        </div>
      </div>
      {aviso === "editado" ? (
        <div className="mb-4 max-w-5xl">
          <Alert tone="success">Contato atualizado.</Alert>
        </div>
      ) : null}

      <div className="grid max-w-5xl gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Dados do contato" />
            <dl className="divide-y divide-border">
              <Item label="Telefone">
                <PhoneChannels phone={contact.phone} whatsapp={contact.whatsapp} name={contact.name} />
                <p className="mt-1 text-xs text-muted">
                  {wa.reason}
                  {origin ? ` · número de ${origin.city}/${origin.uf} (DDD ${origin.ddd})` : ""}
                </p>
              </Item>
              <Item label="E-mail">{contact.email ? <EmailChannels email={contact.email} name={contact.name} /> : null}</Item>
              <Item label="Endereço">{address}</Item>
              <Item label="Origem">
                <OriginTag origin={contact.origin} />
              </Item>
              <Item label="Observações">{contact.notes ? <span className="whitespace-pre-line">{contact.notes}</span> : null}</Item>
              <Item label="Criado">
                {formatDateTime(contact.createdAt)} por {contact.createdBy.name}
              </Item>
              <Item label="Última alteração">
                {contact.updatedAt ? `${formatDateTime(contact.updatedAt)} por ${contact.updatedBy?.name ?? "usuário removido"}` : null}
              </Item>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Notas" description="Acompanhamento: o que foi conversado e combinado" />
            <div className="p-5">
              <NotesPanel
                contactId={contact.id}
                canWrite={can(user, "contacts.edit")}
                currentUserId={user.id}
                isAdmin={user.role === "ADMIN"}
                notes={notes.map((n) => ({
                  id: n.id,
                  body: n.body,
                  createdAt: n.createdAt,
                  author: n.author ? { id: n.author.id, name: n.author.name } : null,
                  avatar: <Avatar name={n.author?.name ?? "?"} size={32} />,
                }))}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-4 self-start">
          {can(user, "contacts.edit") ? (
            <Card>
              <CardHeader title="Foto do contato" description="PNG, JPEG ou WebP, até 1 MB" />
              <div className="p-5">
                <PhotoForm
                  hasPhoto={Boolean(contact.photo)}
                  preview={<ContactAvatar id={contact.id} name={contact.name} photoVersion={contact.photo?.updatedAt} size={64} />}
                  uploadAction={uploadContactPhotoAction.bind(null, contact.id)}
                  removeAction={removeContactPhotoAction.bind(null, contact.id)}
                />
              </div>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Histórico" description="Quem criou, alterou, anotou ou exportou (auditoria)" />
            {history.length === 0 ? (
              <p className="p-5 text-sm text-muted">Sem registros.</p>
            ) : (
              <ol className="divide-y divide-border text-sm">
                {history.map((h) => {
                  const changed = Array.isArray((h.metadata as { changed?: unknown } | null)?.changed)
                    ? ((h.metadata as { changed: string[] }).changed.map((f) => CONTACT_FIELD_LABELS[f] ?? f))
                    : [];
                  return (
                    <li key={h.id} className="px-5 py-3">
                      <p className="font-medium text-foreground">{auditLabel(h.action)}</p>
                      {changed.length ? <p className="text-xs text-muted-strong">Campos: {changed.join(", ")}</p> : null}
                      <p className="text-xs text-muted">
                        {h.actor?.name ?? "Usuário removido"} · {formatDateTime(h.createdAt)}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

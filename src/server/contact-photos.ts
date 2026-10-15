// Foto do contato. PNG, JPEG ou WebP de até 1 MB, tipo conferido pelos bytes (src/lib/image-type.ts).
// Quem pode editar o contato troca a foto; quem pode ver o contato vê a foto (mesma regra de visibilidade).
import "server-only";
import { db } from "./db";
import { recordAudit } from "./audit";
import { visibleTo } from "./contacts";
import { publish } from "./realtime/events";
import type { RequestMeta } from "./request-context";
import type { SessionUser } from "./auth/session";
import { detectImageType } from "@/lib/image-type";
import { assertCan } from "@/lib/permissions";

export const PHOTO_MAX_BYTES = 1024 * 1024;

const findVisible = (viewer: SessionUser, contactId: string) =>
  db.contact.findFirst({ where: { AND: [{ id: contactId }, visibleTo(viewer)] }, select: { id: true, createdById: true } });

export const setContactPhoto = async (viewer: SessionUser, contactId: string, data: Buffer, meta: RequestMeta) => {
  assertCan(viewer, "contacts.edit");
  if (data.length > PHOTO_MAX_BYTES) return "A foto pode ter no máximo 1 MB.";
  const mimeType = detectImageType(data);
  if (!mimeType) return "Use uma imagem PNG, JPEG ou WebP.";
  const contact = await findVisible(viewer, contactId);
  if (!contact) return "Contato não encontrado.";
  const bytes = new Uint8Array(data);
  await db.$transaction(async (tx) => {
    await tx.contactPhoto.upsert({ where: { contactId }, create: { contactId, mimeType, data: bytes }, update: { mimeType, data: bytes } });
    await recordAudit(tx, { actorId: viewer.id, action: "contact.photo_changed", entity: "Contact", entityId: contactId, meta });
    await publish(tx, { type: "contact.updated", contactId, createdById: contact.createdById });
  });
  return null;
};

export const removeContactPhoto = async (viewer: SessionUser, contactId: string, meta: RequestMeta) => {
  assertCan(viewer, "contacts.edit");
  const contact = await findVisible(viewer, contactId);
  if (!contact) return;
  await db.$transaction(async (tx) => {
    const { count } = await tx.contactPhoto.deleteMany({ where: { contactId } });
    if (!count) return;
    await recordAudit(tx, { actorId: viewer.id, action: "contact.photo_removed", entity: "Contact", entityId: contactId, meta });
    await publish(tx, { type: "contact.updated", contactId, createdById: contact.createdById });
  });
};

export const getContactPhoto = (viewer: SessionUser, contactId: string) =>
  db.contactPhoto.findFirst({ where: { contactId, contact: visibleTo(viewer) } });

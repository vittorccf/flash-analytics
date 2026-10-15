// Contatos: quem vê o quê e quem pode fazer o quê. Visibilidade: admin e quem tem "contacts.view_all" veem
// todos; os demais, só os que cadastraram. Ações: conferidas aqui de novo (defesa em profundidade), não só na tela.
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { recordAudit } from "./audit";
import { notifyAdmins } from "./notifications";
import { publish } from "./realtime/events";
import type { RequestMeta } from "./request-context";
import type { SessionUser } from "./auth/session";
import type { ContactInput } from "@/lib/validation";
import { dddsOfRegion, dddsOfUf } from "@/lib/ddd";
import type { ContactFilters } from "@/lib/contact-filters";
import { type ContactSort, contactCursor, keysetOrderBy, keysetWhere } from "@/lib/contact-sort";
import { cursorPaginate, type CursorRequest } from "@/lib/cursor";
import { assertCan, can } from "@/lib/permissions";

export type { ContactFilters };

export const visibleTo = (viewer: SessionUser): Prisma.ContactWhereInput =>
  can(viewer, "contacts.view_all") ? {} : { createdById: viewer.id };

// A mesma regra de visibleTo, sobre os agregados do painel (contagem sem varrer Contact).
const visibleStatsTo = (viewer: SessionUser): Prisma.ContactStatWhereInput =>
  can(viewer, "contacts.view_all") ? {} : { createdById: viewer.id };

const byDdds = (ddds: string[]): Prisma.ContactWhereInput => ({ OR: ddds.map((ddd) => ({ phone: { startsWith: ddd } })) });

const filtersToWhere = (viewer: SessionUser, f: ContactFilters): Prisma.ContactWhereInput => {
  const and: Prisma.ContactWhereInput[] = [visibleTo(viewer)];
  if (f.q) {
    const digits = f.q.replace(/\D/g, "");
    and.push({
      OR: [
        { name: { contains: f.q, mode: "insensitive" } },
        { email: { contains: f.q, mode: "insensitive" } },
        { company: { contains: f.q, mode: "insensitive" } },
        // Telefone a partir de 2 dígitos: o discador e a busca sugerem enquanto a pessoa digita.
        ...(digits.length >= 2 ? [{ phone: { contains: digits } }] : []),
      ],
    });
  }
  if (f.state) and.push({ state: f.state });
  if (f.origin) and.push({ origin: f.origin });
  if (f.dddUf) and.push(byDdds(dddsOfUf(f.dddUf)));
  if (f.region) and.push(byDdds(dddsOfRegion(f.region)));
  if (f.favorites) and.push({ favoritedBy: { some: { userId: viewer.id } } });
  // Filtro por autor só faz sentido para quem vê a equipe; para os demais a visibilidade já restringe.
  if (f.operatorId && can(viewer, "contacts.view_all")) and.push({ createdById: f.operatorId });
  return { AND: and };
};

// --- Duplicados: mesmo telefone ou e-mail, entre os contatos que a pessoa enxerga ---

export const findDuplicates = (viewer: SessionUser, input: { phone: string; email: string | null }, exceptId?: string) =>
  db.contact.findMany({
    where: {
      AND: [
        visibleTo(viewer),
        { OR: [{ phone: input.phone }, ...(input.email ? [{ email: { equals: input.email, mode: "insensitive" as const } }] : [])] },
        ...(exceptId ? [{ id: { not: exceptId } }] : []),
      ],
    },
    select: { id: true, name: true, phone: true, email: true },
    take: 3,
  });

// --- Criar, editar, apagar ---

export const createContact = async (author: SessionUser, input: ContactInput, meta: RequestMeta) => {
  assertCan(author, "contacts.create");
  return db.$transaction(async (tx) => {
    const contact = await tx.contact.create({ data: { ...input, createdById: author.id } });
    await notifyAdmins(
      tx,
      {
        type: "contact.created",
        title: "Novo contato cadastrado",
        body: `${author.name} cadastrou ${contact.name} (${contact.city}/${contact.state}).`,
        link: `/contatos/${contact.id}`,
      },
      author.id,
    );
    await recordAudit(tx, { actorId: author.id, action: "contact.created", entity: "Contact", entityId: contact.id, meta });
    await publish(tx, { type: "contact.created", contactId: contact.id, contactName: contact.name, createdById: author.id, createdByName: author.name });
    return contact;
  });
};

const EDITABLE: (keyof ContactInput)[] = ["name", "phone", "whatsapp", "email", "company", "zipCode", "street", "number", "district", "city", "state", "origin", "notes"];

export const updateContact = async (viewer: SessionUser, id: string, input: ContactInput, meta: RequestMeta) => {
  assertCan(viewer, "contacts.edit");
  return db.$transaction(async (tx) => {
    const current = await tx.contact.findFirst({ where: { AND: [{ id }, visibleTo(viewer)] } });
    if (!current) return false;
    // Auditoria registra QUAIS campos mudaram (não os valores: dado pessoal não vai para o log).
    const changed = EDITABLE.filter((k) => (current[k] ?? null) !== (input[k] ?? null));
    await tx.contact.update({ where: { id }, data: { ...input, updatedAt: new Date(), updatedById: viewer.id } });
    await recordAudit(tx, { actorId: viewer.id, action: "contact.updated", entity: "Contact", entityId: id, metadata: { changed }, meta });
    await publish(tx, { type: "contact.updated", contactId: id, createdById: current.createdById });
    return true;
  });
};

// Exclusão definitiva (LGPD: dado pessoal não fica guardado sem motivo). A auditoria registra só o id.
export const deleteContact = async (viewer: SessionUser, id: string, meta: RequestMeta) => {
  assertCan(viewer, "contacts.delete");
  return db.$transaction(async (tx) => {
    const contact = await tx.contact.findFirst({ where: { AND: [{ id }, visibleTo(viewer)] }, select: { createdById: true } });
    if (!contact) return false;
    await tx.contact.delete({ where: { id } });
    await recordAudit(tx, { actorId: viewer.id, action: "contact.deleted", entity: "Contact", entityId: id, meta });
    await publish(tx, { type: "contact.deleted", contactId: id, createdById: contact.createdById });
    return true;
  });
};

// --- Leitura ---

const listInclude = (viewer: SessionUser) =>
  ({
    createdBy: { select: { id: true, name: true } },
    // Favorito é de cada um: só a marcação de quem está vendo.
    favoritedBy: { where: { userId: viewer.id }, select: { userId: true } },
    photo: { select: { updatedAt: true } },
  }) satisfies Prisma.ContactInclude;

// Total do "N contatos": pelos agregados quando os filtros cabem nas dimensões deles (UF, origem, DDD, autor);
// busca por texto e favoritos contam na própria tabela.
const countContacts = async (viewer: SessionUser, f: ContactFilters) => {
  if (f.q || f.favorites) return db.contact.count({ where: filtersToWhere(viewer, f) });
  const and: Prisma.ContactStatWhereInput[] = [visibleStatsTo(viewer)];
  if (f.state) and.push({ state: f.state });
  if (f.origin) and.push({ origin: f.origin });
  if (f.dddUf) and.push({ ddd: { in: dddsOfUf(f.dddUf) } });
  if (f.region) and.push({ ddd: { in: dddsOfRegion(f.region) } });
  if (f.operatorId && can(viewer, "contacts.view_all")) and.push({ createdById: f.operatorId });
  const { _sum } = await db.contactStat.aggregate({ where: { AND: and }, _sum: { count: true } });
  return _sum.count ?? 0;
};

export const listContacts = async (viewer: SessionUser, filters: ContactFilters, req: CursorRequest, sort: ContactSort) => {
  const where = filtersToWhere(viewer, filters);
  // Cursor inválido (ou de outra ordenação) vira primeira página.
  const valid = keysetWhere(sort, req.cursor, req.direction) !== null;
  const [total, page] = await Promise.all([
    countContacts(viewer, filters),
    cursorPaginate(
      valid ? req : { ...req, cursor: null, direction: "after" },
      ({ cursor, direction, take }) => {
        const beyond = keysetWhere(sort, cursor, direction);
        return db.contact.findMany({
          where: beyond ? { AND: [where, beyond] } : where,
          orderBy: keysetOrderBy(sort, direction),
          take,
          include: listInclude(viewer),
        });
      },
      contactCursor(sort),
    ),
  ]);
  return { ...page, total };
};

export const getContact = (viewer: SessionUser, id: string) =>
  db.contact.findFirst({
    where: { AND: [{ id }, visibleTo(viewer)] },
    include: { ...listInclude(viewer), updatedBy: { select: { name: true } } },
  });

export const listAuthorsForFilter = () =>
  db.user.findMany({
    where: { OR: [{ role: "OPERATOR" }, { contacts: { some: {} } }] },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

// Busca rápida do topo da tela (nome, e-mail, empresa ou telefone), só no que a pessoa enxerga.
export const quickSearchContacts = (viewer: SessionUser, q: string) =>
  db.contact.findMany({
    where: filtersToWhere(viewer, { q }),
    orderBy: [{ name: "asc" }],
    take: 8,
    select: { id: true, name: true, phone: true, email: true, city: true, state: true, whatsapp: true, photo: { select: { updatedAt: true } } },
  });

// Histórico do contato: tudo que a auditoria registrou sobre ele (criação, edições, notas, cartão exportado).
export const contactHistory = (contactId: string) =>
  db.auditLog.findMany({
    where: { entity: "Contact", entityId: contactId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { name: true } } },
  });

// --- Favoritos (de cada usuário) ---

export const toggleFavorite = async (viewer: SessionUser, contactId: string) => {
  const visible = await db.contact.count({ where: { AND: [{ id: contactId }, visibleTo(viewer)] } });
  if (!visible) return null;
  const key = { userId_contactId: { userId: viewer.id, contactId } };
  const existing = await db.contactFavorite.findUnique({ where: key });
  if (existing) await db.contactFavorite.delete({ where: key });
  else await db.contactFavorite.create({ data: { userId: viewer.id, contactId } });
  return !existing;
};

// --- Notas de acompanhamento ---

export const listNotes = (contactId: string) =>
  db.contactNote.findMany({
    where: { contactId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { author: { select: { id: true, name: true } } },
  });

export const addNote = async (viewer: SessionUser, contactId: string, body: string, meta: RequestMeta) => {
  assertCan(viewer, "contacts.edit");
  return db.$transaction(async (tx) => {
    const contact = await tx.contact.findFirst({ where: { AND: [{ id: contactId }, visibleTo(viewer)] }, select: { createdById: true } });
    if (!contact) return false;
    const note = await tx.contactNote.create({ data: { contactId, authorId: viewer.id, body } });
    await recordAudit(tx, { actorId: viewer.id, action: "contact.note_added", entity: "Contact", entityId: contactId, metadata: { noteId: note.id }, meta });
    await publish(tx, { type: "contact.updated", contactId, createdById: contact.createdById });
    return true;
  });
};

// Apaga a própria nota (admin apaga qualquer uma).
export const deleteNote = async (viewer: SessionUser, noteId: string, meta: RequestMeta) =>
  db.$transaction(async (tx) => {
    const note = await tx.contactNote.findFirst({
      where: { id: noteId, ...(viewer.role === "ADMIN" ? {} : { authorId: viewer.id }), contact: visibleTo(viewer) },
      select: { contactId: true, contact: { select: { createdById: true } } },
    });
    if (!note) return false;
    await tx.contactNote.delete({ where: { id: noteId } });
    await recordAudit(tx, { actorId: viewer.id, action: "contact.note_deleted", entity: "Contact", entityId: note.contactId, metadata: { noteId }, meta });
    await publish(tx, { type: "contact.updated", contactId: note.contactId, createdById: note.contact.createdById });
    return true;
  });

// --- Exportação: mesmos filtros e visibilidade da lista, sem paginação (com teto). ---
export const EXPORT_MAX_ROWS = 10_000;

export const listContactsForExport = async (viewer: SessionUser, filters: ContactFilters, format: "csv" | "xlsx", meta: RequestMeta) => {
  assertCan(viewer, "contacts.export");
  const contacts = await db.contact.findMany({
    where: filtersToWhere(viewer, filters),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: EXPORT_MAX_ROWS,
    include: { createdBy: { select: { name: true } } },
  });
  // Exportar é tirar dado pessoal do sistema: fica registrado quem, quando, quanto e em que formato.
  await recordAudit(db, { actorId: viewer.id, action: "contact.exported", entity: "Contact", metadata: { count: contacts.length, format }, meta });
  return contacts;
};

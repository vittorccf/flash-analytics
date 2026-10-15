import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, FileSpreadsheet, FileText, Pencil, Upload, UserPlus } from "lucide-react";
import { requireUser } from "@/server/auth/dal";
import { listContacts, listAuthorsForFilter } from "@/server/contacts";
import { filtersToParams, parseContactFilters } from "@/lib/contact-filters";
import { nextSort, parseSort, sortParam, type ContactSort, type SortKey, CONTACT_CURSOR_LENGTH } from "@/lib/contact-sort";
import { can } from "@/lib/permissions";
import { ORIGIN_LABELS, ORIGINS, UFS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { formatZipCode } from "@/lib/zip-code";
import { REGIONS, UF_NAMES } from "@/lib/ddd";
import { parseCursorRequest } from "@/lib/cursor";
import { ActionMenu } from "@/components/action-menu";
import { EmailChannels, PhoneChannels } from "@/components/contact-channels";
import { FavoriteButton } from "@/components/favorite-button";
import { ContactAvatar } from "@/components/avatar";
import { LiveRefresh } from "@/components/realtime/live-refresh";
import { CursorPagination } from "@/components/cursor-pagination";
import { OriginTag } from "@/components/origin-tag";
import { Alert, Button, Card, EmptyState, Input, PageHeader, Select, Table, Td, Th, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Contatos" };

type SearchParams = Record<string, string | string[] | undefined>;

const NOTICES: Record<string, string> = {
  editado: "Contato atualizado.",
  excluido: "Contato excluído.",
};

// Cabeçalho ordenável: link que inverte a ordem; aria-sort informa leitores de tela.
const SortTh = ({ label, sortKey, sort, base }: { label: string; sortKey: SortKey; sort: ContactSort; base: Record<string, string | undefined> }) => {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  const href = `/contatos?${query({ ...base, ordem: sortParam(nextSort(sort, sortKey)) })}`;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className="border-b border-border bg-subtle/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted"
    >
      <Link href={href} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        <Icon className={active ? "size-3.5 text-foreground" : "size-3.5 opacity-50"} aria-hidden />
      </Link>
    </th>
  );
};

const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
  return search.toString();
};

export default async function ContactsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const isAdmin = user.role === "ADMIN";
  const viewAll = can(user, "contacts.view_all");
  const allowed = { create: can(user, "contacts.create"), edit: can(user, "contacts.edit"), export: can(user, "contacts.export") };
  const filters = parseContactFilters(sp);
  const sort = parseSort(Array.isArray(sp.ordem) ? sp.ordem[0] : sp.ordem);
  const pageReq = parseCursorRequest(sp, CONTACT_CURSOR_LENGTH);
  const [page, operators] = await Promise.all([
    listContacts(user, filters, pageReq, sort),
    viewAll ? listAuthorsForFilter() : Promise.resolve([]),
  ]);
  const hasFilters = Object.values(filtersToParams(filters)).some(Boolean);
  const sortBase = { ...filtersToParams(filters), por: pageReq.pageSize === 10 ? undefined : String(pageReq.pageSize) };
  const params = { ...sortBase, ordem: sortParam(sort) };
  const exportQuery = query(filtersToParams(filters));
  const notice =
    sp.aviso === "criado"
      ? `Contato cadastrado. ${isAdmin ? "Os outros administradores foram notificados." : "Os administradores foram notificados."}`
      : typeof sp.aviso === "string"
        ? NOTICES[sp.aviso]
        : undefined;

  return (
    <>
      <LiveRefresh events={["contact.created", "contact.updated", "contact.deleted", "contacts.imported"]} />
      <PageHeader
        title={viewAll ? "Contatos" : "Meus contatos"}
        description={viewAll ? "Todos os contatos da equipe. A lista se atualiza sozinha." : "Contatos que você cadastrou."}
        action={
          <div className="flex flex-wrap gap-2">
            {allowed.export ? (
            <ActionMenu
              label={hasFilters ? "Exportar contatos filtrados" : "Exportar contatos"}
              trigger={
                <>
                  <Download className="size-4" aria-hidden /> Exportar
                </>
              }
              triggerClassName={buttonClass("secondary")}
              hint={hasFilters ? "Exporta só o que os filtros mostram." : "Exporta todos os contatos que você vê."}
              items={[
                { label: "Excel (.xlsx)", href: `/api/contatos/exportar?formato=xlsx&${exportQuery}`, download: true, icon: <FileSpreadsheet className="size-4 text-muted" aria-hidden /> },
                { label: "CSV", href: `/api/contatos/exportar?formato=csv&${exportQuery}`, download: true, icon: <FileText className="size-4 text-muted" aria-hidden /> },
              ]}
            />
            ) : null}
            {allowed.create ? (
              <>
                <Link href="/contatos/importar" className={buttonClass("secondary")}>
                  <Upload className="size-4" aria-hidden /> Importar
                </Link>
                <Link href="/contatos/novo" className={buttonClass()}>
                  <UserPlus className="size-4" aria-hidden /> Novo contato
                </Link>
              </>
            ) : null}
          </div>
        }
      />
      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {sp.aviso === "sem-permissao" ? (
        <div className="mb-4">
          <Alert tone="warning">Você não tem permissão para essa ação. Peça a um administrador.</Alert>
        </div>
      ) : null}

      <Card>
        <form className="flex flex-wrap items-end gap-3 border-b border-border p-4" role="search">
          <div className="min-w-48 flex-1">
            <label htmlFor="q" className="mb-1 block text-xs font-medium text-muted">
              Buscar
            </label>
            <Input id="q" name="q" defaultValue={filters.q} placeholder="Nome, e-mail, empresa ou telefone" maxLength={100} />
          </div>
          <div>
            <label htmlFor="uf" className="mb-1 block text-xs font-medium text-muted">
              UF
            </label>
            <Select id="uf" name="uf" defaultValue={filters.state ?? ""}>
              <option value="">Todas</option>
              {UFS.map((uf) => (
                <option key={uf}>{uf}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="regiao" className="mb-1 block text-xs font-medium text-muted">
              Região do número
            </label>
            <Select id="regiao" name="regiao" defaultValue={filters.region ?? ""}>
              <option value="">Todas</option>
              {REGIONS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          {/* Filtro vindo do mapa do painel: mantido ao refiltrar. */}
          {filters.dddUf ? <input type="hidden" name="ddduf" value={filters.dddUf} /> : null}
          <div>
            <label htmlFor="origem" className="mb-1 block text-xs font-medium text-muted">
              Origem
            </label>
            <Select id="origem" name="origem" defaultValue={filters.origin ?? ""}>
              <option value="">Todas</option>
              {ORIGINS.map((o) => (
                <option key={o} value={o}>
                  {ORIGIN_LABELS[o]}
                </option>
              ))}
            </Select>
          </div>
          {viewAll ? (
            <div>
              <label htmlFor="operador" className="mb-1 block text-xs font-medium text-muted">
                Cadastrado por
              </label>
              <Select id="operador" name="operador" defaultValue={filters.operatorId ?? ""}>
                <option value="">Todos</option>
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <label className="flex h-10 items-center gap-2 text-sm">
            <input type="checkbox" name="favoritos" value="1" defaultChecked={filters.favorites} className="size-4 accent-primary" />
            Só favoritos
          </label>
          {sortParam(sort) ? <input type="hidden" name="ordem" value={sortParam(sort)} /> : null}
          <div className="flex gap-2">
            <Button type="submit" variant="secondary">
              Filtrar
            </Button>
            {hasFilters ? (
              <Link href="/contatos" className={buttonClass("ghost")}>
                Limpar
              </Link>
            ) : null}
          </div>
        </form>
        {filters.dddUf ? (
          <p className="border-b border-border px-4 py-2 text-sm text-muted-strong" role="status">
            Mostrando números com DDD de <strong className="font-semibold text-foreground">{UF_NAMES[filters.dddUf]}</strong>.
          </p>
        ) : null}

        {page.items.length === 0 ? (
          <EmptyState
            title={hasFilters ? "Nenhum contato com estes filtros" : "Nenhum contato ainda"}
            description={hasFilters ? undefined : "Cadastre o primeiro contato ou importe uma planilha."}
            action={
              !hasFilters && allowed.create ? (
                <div className="flex justify-center gap-2">
                  <Link href="/contatos/novo" className={buttonClass()}>
                    Cadastrar contato
                  </Link>
                  <Link href="/contatos/importar" className={buttonClass("secondary")}>
                    Importar planilha
                  </Link>
                </div>
              ) : null
            }
          />
        ) : (
          <>
            <Table label="Contatos">
              <thead>
                <tr>
                  <SortTh label="Nome" sortKey="nome" sort={sort} base={sortBase} />
                  <Th>Contato</Th>
                  <SortTh label="Cidade/UF" sortKey="cidade" sort={sort} base={sortBase} />
                  <SortTh label="Origem" sortKey="origem" sort={sort} base={sortBase} />
                  {viewAll ? <Th>Cadastrado por</Th> : null}
                  <SortTh label="Cadastrado em" sortKey="cadastro" sort={sort} base={sortBase} />
                  <Th>
                    <span className="sr-only">Ações</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((c) => (
                  <tr key={c.id} className="hover:bg-subtle/50">
                    <Td>
                      <div className="flex items-center gap-2">
                        <FavoriteButton contactId={c.id} name={c.name} initial={c.favoritedBy.length > 0} />
                        <ContactAvatar id={c.id} name={c.name} photoVersion={c.photo?.updatedAt} size={32} />
                        <div>
                          <Link href={`/contatos/${c.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                            {c.name}
                          </Link>
                          {c.company ? <p className="text-xs text-muted">{c.company}</p> : null}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <PhoneChannels phone={c.phone} whatsapp={c.whatsapp} name={c.name} />
                      {c.email ? (
                        <div className="max-w-56 text-xs text-muted">
                          <EmailChannels email={c.email} name={c.name} />
                        </div>
                      ) : null}
                    </Td>
                    <Td>
                      <p className="whitespace-nowrap">
                        {c.city}/{c.state}
                      </p>
                      {c.district || c.zipCode ? (
                        <p className="text-xs text-muted">
                          {[c.district, c.zipCode ? `CEP ${formatZipCode(c.zipCode)}` : null].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </Td>
                    <Td>
                      <OriginTag origin={c.origin} />
                    </Td>
                    {viewAll ? <Td className="whitespace-nowrap">{c.createdBy.name}</Td> : null}
                    <Td className="whitespace-nowrap text-muted">{formatDateTime(c.createdAt)}</Td>
                    <Td className="text-right">
                      {allowed.edit ? (
                      <Link
                        href={`/contatos/${c.id}/editar`}
                        aria-label={`Editar ${c.name}`}
                        title="Editar"
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-strong hover:bg-subtle hover:text-foreground"
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Link>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <CursorPagination page={page} basePath="/contatos" params={params} noun={["contato", "contatos"]} />
          </>
        )}
      </Card>
    </>
  );
}

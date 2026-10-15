import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { requireAdmin } from "@/server/auth/dal";
import { listSignupRequests } from "@/server/signup-requests";
import { SIGNUP_STATUS_LABELS } from "@/lib/labels";
import { formatDateTime, formatRelative } from "@/lib/format";
import { parsePageRequest } from "@/lib/pagination";
import { LiveRefresh } from "@/components/realtime/live-refresh";
import { Pagination } from "@/components/pagination";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { DecisionForm } from "./decision-form";

export const metadata: Metadata = { title: "Solicitações de acesso" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SignupRequestsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const history = sp.aba === "historico";
  const page = await listSignupRequests(history ? "DECIDED" : "PENDING", parsePageRequest(sp));

  const tab = (active: boolean) =>
    clsx("rounded-md px-3 py-1.5 text-sm font-medium", active ? "bg-surface text-foreground elevation-1" : "text-muted hover:text-foreground");

  return (
    <>
      <LiveRefresh events={["signup.requested", "signup.decided"]} />
      <PageHeader
        title="Solicitações de acesso"
        description="Pedidos feitos na tela de login. Quem pediu vê a decisão na hora, sem recarregar a página."
      />
      <nav aria-label="Filtro de solicitações" className="mb-4 inline-flex rounded-lg bg-subtle p-1">
        <Link href="/admin/solicitacoes" className={tab(!history)} aria-current={!history ? "page" : undefined}>
          Pendentes
        </Link>
        <Link href="/admin/solicitacoes?aba=historico" className={tab(history)} aria-current={history ? "page" : undefined}>
          Histórico
        </Link>
      </nav>
      <Card>
        {page.items.length === 0 ? (
          <EmptyState
            title={history ? "Nenhuma solicitação analisada" : "Nenhuma solicitação pendente"}
            description={history ? undefined : "Novos pedidos aparecem aqui automaticamente."}
          />
        ) : (
          <>
            <Table label="Solicitações">
              <thead>
                <tr>
                  <Th>Pessoa</Th>
                  <Th>Pedido em</Th>
                  {history ? <Th>Decisão</Th> : <Th>Origem</Th>}
                  {history ? null : <Th className="text-right">Ação</Th>}
                </tr>
              </thead>
              <tbody>
                {page.items.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <p className="font-medium text-foreground">{r.name}</p>
                      <p className="text-xs text-muted">{r.email}</p>
                      {/* Não há confirmação por e-mail: o admin precisa reconhecer a pessoa antes de aprovar. */}
                      {history ? null : <p className="mt-1 text-xs text-warning-strong">E-mail não verificado: confirme quem é antes de aprovar.</p>}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">
                      <span title={formatDateTime(r.createdAt)}>{formatRelative(r.createdAt)}</span>
                    </Td>
                    {history ? (
                      <Td>
                        <Badge tone={r.status === "APPROVED" ? "success" : "danger"}>{SIGNUP_STATUS_LABELS[r.status]}</Badge>
                        <p className="mt-1 text-xs text-muted">
                          {r.decidedBy?.name ?? "—"} · {formatDateTime(r.decidedAt)}
                        </p>
                        {r.decisionNote ? <p className="mt-1 text-xs text-muted-strong">“{r.decisionNote}”</p> : null}
                      </Td>
                    ) : (
                      <Td className="text-xs text-muted">IP {r.ipAddress ?? "não registrado"}</Td>
                    )}
                    {history ? null : (
                      <Td className="text-right">
                        <DecisionForm id={r.id} name={r.name} />
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} basePath="/admin/solicitacoes" params={{ aba: history ? "historico" : undefined }} />
          </>
        )}
      </Card>
    </>
  );
}

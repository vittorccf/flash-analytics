import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/server/auth/dal";
import { loadDashboard } from "@/server/dashboard";
import { ORIGIN_LABELS } from "@/lib/labels";
import { formatDayKey, formatNumber, formatRelative } from "@/lib/format";
import { LiveRefresh } from "@/components/realtime/live-refresh";
import { Card, CardHeader, EmptyState, Table, Td, Th } from "@/components/ui";
import { DailyChart, HorizontalBars } from "./charts";
import { PhoneRegionsSection } from "./phone-regions-section";

export const metadata: Metadata = { title: "Painel" };

// featured: o indicador principal ganha o degradê da marca (um por tela, para continuar sendo destaque).
const Kpi = ({ label, value, detail, href, featured = false }: { label: string; value: string; detail?: string; href?: string; featured?: boolean }) => {
  const body = (
    <>
      <p className={featured ? "text-sm text-on-brand/85" : "text-sm text-muted"}>{label}</p>
      <p className={featured ? "mt-1 text-4xl font-semibold tracking-tight tabular-nums" : "mt-1 text-3xl font-semibold tracking-tight text-foreground tabular-nums"}>{value}</p>
      {detail ? <p className={featured ? "mt-1 text-xs text-on-brand/85" : "mt-1 text-xs text-muted"}>{detail}</p> : null}
    </>
  );
  return (
    <Card className={featured ? "surface-brand border-transparent p-5 elevation-3" : "p-5"}>
      {href ? (
        <Link href={href} className="block hover:opacity-80">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
};

const trend = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? "sem base na semana anterior" : "igual à semana anterior";
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct === 0 ? "igual à semana anterior" : `${pct > 0 ? "+" : ""}${pct}% vs. semana anterior`;
};

export default async function AdminDashboardPage() {
  await requireAdmin();
  const d = await loadDashboard();

  return (
    <>
      {/* Painel em tempo real: novos contatos, solicitações, usuários e eventos de acesso recarregam as métricas. */}
      <LiveRefresh events={["contact.created", "contact.updated", "contact.deleted", "contacts.imported", "signup.requested", "signup.decided", "user.changed", "audit.recorded"]} debounceMs={800} />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
        <p className="mt-1 text-sm text-muted">Atualiza sozinho a cada novo evento.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi featured label="Contatos cadastrados" value={formatNumber(d.totals.total)} detail={`${formatNumber(d.totals.today)} hoje`} />
        <Kpi label="Últimos 7 dias" value={formatNumber(d.totals.last7)} detail={trend(d.totals.last7, d.totals.prev7)} />
        <Kpi label="Operadores ativos" value={formatNumber(d.operators)} href="/admin/usuarios" />
        <Kpi
          label="Solicitações pendentes"
          value={formatNumber(d.pendingRequests)}
          detail={d.pendingRequests > 0 ? "Clique para analisar" : "Nada aguardando"}
          href="/admin/solicitacoes"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Contatos por dia" description="Últimos 14 dias (horário de Brasília)" />
          <div className="p-4">
            <DailyChart data={d.perDay.map((p) => ({ label: formatDayKey(p.day), count: p.count }))} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Segurança (24 h)" description="Eventos de acesso" />
          <dl className="grid grid-cols-3 gap-2 p-5 text-center">
            <div>
              <dt className="text-xs text-muted">Logins</dt>
              <dd className="mt-1 text-2xl font-semibold text-success-strong">{formatNumber(d.security.logins)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Falhas</dt>
              <dd className="mt-1 text-2xl font-semibold text-warning-strong">{formatNumber(d.security.failures)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Bloqueios</dt>
              <dd className="mt-1 text-2xl font-semibold text-danger-strong">{formatNumber(d.security.blocked)}</dd>
            </div>
          </dl>
          <div className="border-t border-border px-5 py-3 text-right">
            <Link href="/admin/atividade?grupo=auth" className="text-sm font-medium text-primary hover:underline">
              Ver atividade de acesso
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Por origem" description="Como o contato chegou" />
          <div className="p-4">
            {d.byOrigin.length ? (
              <HorizontalBars colorful data={d.byOrigin.map((o) => ({ label: ORIGIN_LABELS[o.origin], count: o.count }))} />
            ) : (
              <EmptyState title="Sem dados ainda" />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Por UF do endereço" description="10 estados com mais contatos" />
          <div className="p-4">
            {d.byState.length ? (
              <HorizontalBars data={d.byState.map((s) => ({ label: s.state, count: s.count }))} />
            ) : (
              <EmptyState title="Sem dados ainda" />
            )}
          </div>
        </Card>
      </div>

      <PhoneRegionsSection data={d.phoneRegions} />

      <h2 className="mt-8 text-lg font-semibold tracking-tight">Equipe e cadastros recentes</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Por quem cadastrou" description="Operadores e administradores" />
          {d.byOperator.length ? (
            <Table label="Contatos por quem cadastrou">
              <thead>
                <tr>
                  <Th>Quem cadastrou</Th>
                  <Th className="text-right">Contatos</Th>
                  <Th>Último cadastro</Th>
                </tr>
              </thead>
              <tbody>
                {d.byOperator.map((o) => (
                  <tr key={o.id}>
                    <Td>
                      <Link href={`/contatos?operador=${o.id}`} className="font-medium text-primary hover:underline">
                        {o.name}
                      </Link>
                    </Td>
                    <Td className="text-right tabular-nums">{formatNumber(o.count)}</Td>
                    <Td className="text-muted">{o.lastAt ? formatRelative(o.lastAt) : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="Nenhum contato cadastrado" />
          )}
        </Card>
        <Card>
          <CardHeader
            title="Cadastros recentes"
            action={
              <Link href="/contatos" className="text-sm font-medium text-primary hover:underline">
                Ver todos
              </Link>
            }
          />
          {d.recent.length ? (
            <ul className="divide-y divide-border">
              {d.recent.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{c.name}</p>
                    <p className="truncate text-xs text-muted">
                      {c.city}/{c.state} · por {c.createdBy.name}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">{formatRelative(c.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhum contato cadastrado" />
          )}
        </Card>
      </div>
    </>
  );
}

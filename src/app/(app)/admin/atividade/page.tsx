import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/server/auth/dal";
import { ACTIVITY_GROUPS, isActivityGroup, listActivity, ACTIVITY_CURSOR_LENGTH } from "@/server/activity";
import { auditLabel } from "@/lib/labels";
import { describeUserAgent, formatDateTime } from "@/lib/format";
import { parseCursorRequest } from "@/lib/cursor";
import { LiveRefresh } from "@/components/realtime/live-refresh";
import { CursorPagination } from "@/components/cursor-pagination";
import { Badge, Card, chipClass, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";

export const metadata: Metadata = { title: "Atividade" };

const toneOf = (action: string) =>
  /failed|locked|blocked|rate_limited|disabled|rejected/.test(action)
    ? "danger"
    : action.startsWith("auth.")
      ? "neutral"
      : "primary";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const group = isActivityGroup(sp.grupo) ? sp.grupo : null;
  const page = await listActivity(group, parseCursorRequest(sp, ACTIVITY_CURSOR_LENGTH));

  return (
    <>
      <LiveRefresh events={["audit.recorded"]} debounceMs={600} />
      <PageHeader title="Atividade" description="Trilha de auditoria: quem fez o quê, quando e de onde. Atualiza em tempo real." />
      <nav aria-label="Filtrar atividade" className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/atividade" className={chipClass(!group)} aria-current={!group ? "page" : undefined}>
          Tudo
        </Link>
        {Object.entries(ACTIVITY_GROUPS).map(([key, g]) => (
          <Link key={key} href={`/admin/atividade?grupo=${key}`} className={chipClass(group === key)} aria-current={group === key ? "page" : undefined}>
            {g.label}
          </Link>
        ))}
      </nav>
      <Card>
        {page.items.length === 0 ? (
          <EmptyState title="Nenhum evento registrado" />
        ) : (
          <>
            <Table label="Eventos de auditoria">
              <thead>
                <tr>
                  <Th>Quando</Th>
                  <Th>Evento</Th>
                  <Th>Quem</Th>
                  <Th>Origem</Th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((e) => {
                  const meta = (e.metadata ?? {}) as Record<string, unknown>;
                  return (
                    <tr key={e.id}>
                      <Td className="whitespace-nowrap text-muted">{formatDateTime(e.createdAt)}</Td>
                      <Td>
                        <Badge tone={toneOf(e.action)}>{auditLabel(e.action)}</Badge>
                        {typeof meta.email === "string" && !e.actor ? <p className="mt-1 text-xs text-muted">{meta.email}</p> : null}
                      </Td>
                      <Td>
                        {e.actor ? (
                          <span title={e.actor.email}>{e.actor.name}</span>
                        ) : (
                          <span className="text-muted">{meta.via === "cli" ? "Linha de comando" : "Anônimo"}</span>
                        )}
                      </Td>
                      <Td className="text-xs text-muted">
                        <p>{e.ipAddress ?? "IP não registrado"}</p>
                        <p>{describeUserAgent(e.userAgent)}</p>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <CursorPagination page={page} basePath="/admin/atividade" params={{ grupo: group ?? undefined }} />
          </>
        )}
      </Card>
    </>
  );
}

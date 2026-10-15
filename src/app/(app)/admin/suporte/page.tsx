import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/dal";
import { requestMeta } from "@/server/request-context";
import { listSupportTickets, resolveSupportTicket } from "@/server/support";
import { formatDateTime, formatRelative } from "@/lib/format";
import { SUPPORT, SUPPORT_PHONE_LABEL, SUPPORT_TYPES, type SupportType } from "@/lib/support";
import { LiveRefresh } from "@/components/realtime/live-refresh";
import { Badge, Button, Card, EmptyState, PageHeader, chipClass } from "@/components/ui";

export const metadata: Metadata = { title: "Suporte" };

async function resolveAction(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const id = z.string().min(1).max(40).parse(formData.get("id"));
  await resolveSupportTicket(id, admin.id, await requestMeta());
  revalidatePath("/admin/suporte");
}

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  await requireAdmin();
  const resolved = (await searchParams).aba === "resolvidos";
  const { items, total } = await listSupportTickets(resolved ? "RESOLVED" : "OPEN", 1);

  return (
    <>
      <LiveRefresh events={["support.created"]} />
      <PageHeader
        title="Suporte"
        description={`Chamados abertos pelo botão de suporte. Atendimento: WhatsApp ${SUPPORT_PHONE_LABEL} · ${SUPPORT.email}`}
      />
      <nav aria-label="Filtrar chamados" className="mb-4 flex gap-2">
        <Link href="/admin/suporte" className={chipClass(!resolved)} aria-current={!resolved ? "page" : undefined}>
          Abertos
        </Link>
        <Link href="/admin/suporte?aba=resolvidos" className={chipClass(resolved)} aria-current={resolved ? "page" : undefined}>
          Resolvidos
        </Link>
      </nav>
      <Card>
        {items.length === 0 ? (
          <EmptyState title={resolved ? "Nenhum chamado resolvido" : "Nenhum chamado aberto"} description={resolved ? undefined : "Novos chamados aparecem aqui na hora."} />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((t) => (
              <li key={t.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone={t.type === "erro" || t.type === "acesso" ? "warning" : "neutral"}>{SUPPORT_TYPES[t.type as SupportType] ?? t.type}</Badge>
                    <span className="font-medium text-foreground">{t.user?.name ?? t.name ?? "Visitante"}</span>
                    <span className="text-xs text-muted">{t.user?.email ?? t.replyTo ?? ""}</span>
                  </p>
                  <p className="whitespace-pre-line text-sm text-foreground">{t.message}</p>
                  <p className="text-xs text-muted">
                    Protocolo {t.id.slice(-6).toUpperCase()} · <span title={formatDateTime(t.createdAt)}>{formatRelative(t.createdAt)}</span>
                    {t.page ? ` · tela ${t.page}` : ""}
                    {t.resolvedAt ? ` · resolvido ${formatDateTime(t.resolvedAt)}` : ""}
                  </p>
                </div>
                {resolved ? null : (
                  <form action={resolveAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <Button type="submit" variant="secondary" size="sm">
                      Marcar como resolvido
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        {total > items.length ? <p className="border-t border-border px-5 py-3 text-xs text-muted">Mostrando {items.length} de {total}.</p> : null}
      </Card>
    </>
  );
}

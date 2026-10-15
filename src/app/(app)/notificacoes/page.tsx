import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/dal";
import { listNotifications, markAllRead } from "@/server/notifications";
import { formatDateTime, formatRelative } from "@/lib/format";
import { parsePageRequest } from "@/lib/pagination";
import { LiveRefresh } from "@/components/realtime/live-refresh";
import { Pagination } from "@/components/pagination";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Notificações" };

async function markAllReadAction() {
  "use server";
  const user = await requireAdmin();
  await markAllRead(user.id);
  revalidatePath("/", "layout");
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAdmin();
  const page = await listNotifications(user.id, parsePageRequest(await searchParams));
  const hasUnread = page.items.some((n) => !n.readAt);

  return (
    <>
      <LiveRefresh events={["contact.created", "signup.requested"]} />
      <PageHeader
        title="Notificações"
        description="Avisos de novos contatos e de pedidos de acesso."
        action={
          hasUnread ? (
            <form action={markAllReadAction}>
              <Button type="submit" variant="secondary">
                Marcar todas como lidas
              </Button>
            </form>
          ) : null
        }
      />
      <Card>
        {page.items.length === 0 ? (
          <EmptyState title="Nenhuma notificação" description="Você será avisado aqui e na tela assim que algo acontecer." />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {page.items.map((n) => (
                <li key={n.id} className="flex items-start gap-3 px-5 py-4">
                  <span className={n.readAt ? "mt-1.5 size-2 shrink-0 rounded-full bg-transparent" : "mt-1.5 size-2 shrink-0 rounded-full bg-primary"} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {n.title}
                      {n.readAt ? null : <span className="sr-only"> (não lida)</span>}
                    </p>
                    <p className="text-sm text-muted-strong">{n.body}</p>
                    {n.link ? (
                      <Link href={n.link} className="text-sm font-medium text-primary hover:underline">
                        Abrir
                      </Link>
                    ) : null}
                  </div>
                  <time dateTime={n.createdAt.toISOString()} title={formatDateTime(n.createdAt)} className="shrink-0 text-xs text-muted">
                    {formatRelative(n.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
            <Pagination page={page} basePath="/notificacoes" params={{}} />
          </>
        )}
      </Card>
    </>
  );
}

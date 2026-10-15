import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { requireAdmin } from "@/server/auth/dal";
import { Avatar } from "@/components/avatar";
import { presetOf } from "@/lib/permissions";
import { listUsers } from "@/server/users";
import { ROLE_LABELS, USER_STATUS_LABELS } from "@/lib/labels";
import { formatNumber, formatRelative } from "@/lib/format";
import { parsePageRequest } from "@/lib/pagination";
import { LiveRefresh } from "@/components/realtime/live-refresh";
import { Pagination } from "@/components/pagination";
import { Alert, Badge, Card, CardHeader, PageHeader, Table, Td, Th, buttonClass } from "@/components/ui";
import { CreateUserForm } from "./create-user-form";
import { UserActions } from "./user-actions";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const page = await listUsers(parsePageRequest(sp));

  return (
    <>
      <LiveRefresh events={["user.changed"]} />
      <PageHeader title="Usuários" description="Administradores e operadores com acesso ao sistema." />
      {sp.aviso === "excluido" ? (
        <div className="mb-4">
          <Alert tone="success">Usuário excluído.</Alert>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="min-w-0">
          <Table label="Usuários">
            <thead>
              <tr>
                <Th>Usuário</Th>
                <Th>Perfil</Th>
                <Th>Último acesso</Th>
                <Th className="text-right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((u) => {
                const locked = u.lockedUntil && u.lockedUntil > new Date();
                return (
                  <tr key={u.id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={u.name} size={28} />
                        <Link href={`/admin/usuarios/${u.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                          {u.name}
                        </Link>
                      </div>
                      <p className="text-xs text-muted">{u.email}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge tone={u.status === "ACTIVE" ? "success" : "neutral"}>{USER_STATUS_LABELS[u.status]}</Badge>
                        {u.totpEnabledAt ? <Badge tone="primary">2FA</Badge> : null}
                        {locked ? <Badge tone="danger">Bloqueado por tentativas</Badge> : null}
                        {u.mustChangePassword ? <Badge tone="warning">Senha provisória</Badge> : null}
                      </div>
                    </Td>
                    <Td>
                      <p>{ROLE_LABELS[u.role]}</p>
                      {u.role === "OPERATOR" ? (
                        <p className="text-xs text-muted">
                          {presetOf(u.permissions)?.label ?? "Permissões personalizadas"} · {formatNumber(u._count.contacts)} contatos
                        </p>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">
                      {u.lastLoginAt ? formatRelative(u.lastLoginAt) : "Nunca"}
                      <p className="text-xs">{u._count.sessions === 1 ? "1 sessão ativa" : `${u._count.sessions} sessões ativas`}</p>
                    </Td>
                    <Td className="text-right">
                      <Link href={`/admin/usuarios/${u.id}`} className={`${buttonClass("ghost", "sm")} mb-1`}>
                        <Pencil className="size-4" aria-hidden /> Editar
                      </Link>
                      <UserActions
                        userId={u.id}
                        name={u.name}
                        active={u.status === "ACTIVE"}
                        hasTwoFactor={Boolean(u.totpEnabledAt)}
                        isSelf={u.id === admin.id}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination page={page} basePath="/admin/usuarios" params={{}} />
        </Card>
        <Card className="self-start">
          <CardHeader title="Novo usuário" description="Recebe uma senha provisória de uso único." />
          <CreateUserForm />
        </Card>
      </div>
    </>
  );
}

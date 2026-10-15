import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/server/auth/dal";
import { getUserForAdmin } from "@/server/user-admin";
import { USER_STATUS_LABELS } from "@/lib/labels";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { DeleteUser, EditUserForm } from "./edit-user-form";

export const metadata: Metadata = { title: "Editar usuário" };

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const user = await getUserForAdmin(id.slice(0, 40));
  if (!user) notFound();
  const isSelf = user.id === admin.id;

  return (
    <>
      <Link href="/admin/usuarios" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Usuários
      </Link>
      <PageHeader
        title={user.name}
        description={`Criado em ${formatDateTime(user.createdAt)} · último acesso ${user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "nunca"}`}
        action={<Badge tone={user.status === "ACTIVE" ? "success" : "neutral"}>{USER_STATUS_LABELS[user.status]}</Badge>}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="p-6">
          <EditUserForm user={{ id: user.id, name: user.name, email: user.email, role: user.role, permissions: user.permissions }} isSelf={isSelf} />
        </Card>
        <div className="space-y-4 self-start">
        <Card>
          <CardHeader title="Excluir usuário" description="Desativar, redefinir senha e remover 2FA ficam na lista de usuários." />
          <div className="space-y-3 p-5 text-sm">
            {isSelf ? (
              <p className="text-muted">Você não pode excluir a própria conta.</p>
            ) : user._count.contacts > 0 ? (
              <p className="text-muted">
                {user.name} cadastrou {formatNumber(user._count.contacts)} contato(s). Para manter o histórico, desative a conta em vez
                de excluir.
              </p>
            ) : (
              <>
                <p className="text-muted">Remove a conta e encerra as sessões abertas. A auditoria continua registrando o que ela fez.</p>
                <DeleteUser id={user.id} name={user.name} />
              </>
            )}
          </div>
        </Card>
        </div>
      </div>
    </>
  );
}

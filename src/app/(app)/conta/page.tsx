import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { requireUser } from "@/server/auth/dal";
import { getSession } from "@/server/auth/session";
import { otpauthUrl } from "@/server/auth/totp";
import { beginTwoFactorEnrollment, listOwnSessions } from "@/server/users";
import { ROLE_LABELS } from "@/lib/labels";
import { describeUserAgent, formatRelative } from "@/lib/format";
import { Badge, Button, Card, CardHeader, PageHeader, buttonClass } from "@/components/ui";
import { revokeOtherSessionsAction } from "./actions";
import { DisableTwoFactorForm, EnableTwoFactorForm } from "./two-factor-forms";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const user = await requireUser();
  const session = (await getSession())!;
  const sessions = await listOwnSessions(user.id);

  // Segredo pendente (ainda não confirmado) só é gerado para quem não tem 2FA ativo.
  const secret = user.totpEnabledAt ? null : await beginTwoFactorEnrollment(user.id);
  const qr = secret ? await QRCode.toDataURL(otpauthUrl(secret, user.email), { margin: 1, width: 180 }) : null;

  return (
    <>
      <PageHeader title="Minha conta" description={`${user.name} · ${ROLE_LABELS[user.role]} · ${user.email}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Verificação em duas etapas"
            description="Um código do celular, além da senha, a cada login."
            action={user.totpEnabledAt ? <Badge tone="success">Ativa</Badge> : <Badge tone="warning">Desativada</Badge>}
          />
          <div className="p-5">
            {user.totpEnabledAt ? (
              <DisableTwoFactorForm />
            ) : (
              <div className="space-y-4">
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-strong">
                  <li>Abra um app autenticador (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
                  <li>Leia o QR code ou digite a chave.</li>
                  <li>Informe o código de 6 dígitos para confirmar.</li>
                </ol>
                {qr && secret ? (
                  <div className="flex flex-wrap items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no servidor */}
                    <img src={qr} alt="QR code para configurar o aplicativo autenticador" width={180} height={180} className="rounded-lg border border-border" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted">Chave manual</p>
                      <code className="block break-all font-mono text-sm select-all">{secret.match(/.{1,4}/g)?.join(" ")}</code>
                    </div>
                  </div>
                ) : null}
                <EnableTwoFactorForm />
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Senha" />
            <div className="p-5">
              <Link href="/conta/senha" className={buttonClass("secondary")}>
                Trocar senha
              </Link>
            </div>
          </Card>
          <Card>
            <CardHeader
              title="Sessões ativas"
              description="Navegadores conectados à sua conta."
              action={
                sessions.length > 1 ? (
                  <form action={revokeOtherSessionsAction}>
                    <Button type="submit" variant="secondary" size="sm">
                      Encerrar as outras
                    </Button>
                  </form>
                ) : null
              }
            />
            <ul className="divide-y divide-border">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">
                      {describeUserAgent(s.userAgent)} {s.id === session.id ? <Badge tone="primary">Esta sessão</Badge> : null}
                    </p>
                    <p className="text-xs text-muted">
                      {s.ipAddress ?? "IP não registrado"} · iniciada {formatRelative(s.createdAt)}
                    </p>
                  </div>
                  <span className="text-xs text-muted">ativa {formatRelative(s.lastSeenAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

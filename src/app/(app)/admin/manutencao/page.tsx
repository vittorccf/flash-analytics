import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/dal";
import { DEMO_MAX, RESET_SCOPES, RETENTION, dataResetAllowed, demoDataAllowed } from "@/server/maintenance";
import { Alert, Card, CardHeader, PageHeader } from "@/components/ui";
import { CleanupNow, ResetDataForm, SeedDemoForm } from "./maintenance-forms";

export const metadata: Metadata = { title: "Manutenção" };

export default async function MaintenancePage() {
  await requireAdmin();
  const resetAllowed = dataResetAllowed();
  const demoAllowed = demoDataAllowed();

  return (
    <>
      <PageHeader title="Manutenção" description="Limpeza automática, dados de teste e limpeza da base. Tudo fica registrado na Atividade." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Job de limpeza" description="Roda sozinho todo dia às 3h (Brasília) e pode ser rodado aqui" />
          <div className="space-y-4 p-5 text-sm">
            <ul className="list-disc space-y-1 pl-5 text-muted-strong">
              <li>Sessões e etapas de 2FA expiradas</li>
              <li>Controles de tentativas (rate limit) vencidos</li>
              <li>Notificações lidas há mais de {RETENTION.readNotificationsDays} dias</li>
              <li>Solicitações de acesso decididas há mais de {RETENTION.decidedSignupRequestsDays} dias (dado pessoal sem uso)</li>
            </ul>
            <p className="text-xs text-muted">
              Na Vercel: Cron em <code className="font-mono">vercel.json</code> + variável <code className="font-mono">CRON_SECRET</code>. Em
              servidor próprio: <code className="font-mono">npm run job:limpeza</code> no cron.
            </p>
            <CleanupNow />
          </div>
        </Card>

        <Card>
          <CardHeader title="Dados de teste" description={`Contatos realistas (até ${DEMO_MAX} por vez), divididos entre os operadores ativos`} />
          <div className="space-y-3 p-5 text-sm">
            {demoAllowed ? (
              <SeedDemoForm max={DEMO_MAX} />
            ) : (
              <Alert tone="warning">Desativado em produção. Para liberar só os dados de teste, defina ALLOW_DEMO_DATA=true.</Alert>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Limpar a base" description="Apaga dados de verdade, sem volta. Usuários e auditoria nunca são apagados aqui." />
          <div className="max-w-md p-5">
            {resetAllowed ? (
              <ResetDataForm scopes={RESET_SCOPES} />
            ) : (
              <Alert tone="warning">Desativado em produção (apaga dados sem volta). Para liberar, defina ALLOW_DATA_RESET=true.</Alert>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

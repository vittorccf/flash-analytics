import type { Metadata } from "next";
import { requireUser } from "@/server/auth/dal";
import { Alert, Card, PageHeader } from "@/components/ui";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Trocar senha" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPendingPasswordChange: true });
  return (
    <>
      <PageHeader title="Trocar senha" description="As outras sessões abertas com a senha antiga são encerradas." />
      {user.mustChangePassword ? (
        <div className="mb-4 max-w-lg">
          <Alert tone="warning">Você entrou com uma senha provisória. Defina uma senha pessoal para continuar.</Alert>
        </div>
      ) : null}
      <Card className="max-w-lg p-6">
        <PasswordForm />
      </Card>
    </>
  );
}

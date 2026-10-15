import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/server/auth/dal";
import { currentWaitingRequest } from "@/server/signup-requests";
import { AuthShell } from "./auth-shell";
import { LoginScreen } from "./login-screen";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));

  // Quem já pediu acesso e voltou (ou fechou a aba) cai direto na tela de espera.
  const waiting = await currentWaitingRequest();

  return (
    <AuthShell>
      <LoginScreen waiting={waiting ? { name: waiting.name, email: waiting.email } : null} />
    </AuthShell>
  );
}

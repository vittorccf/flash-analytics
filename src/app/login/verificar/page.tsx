import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasPendingChallenge } from "@/server/auth/login";
import { AuthShell } from "../auth-shell";
import { TwoFactorForm } from "./two-factor-form";

export const metadata: Metadata = { title: "Verificação em duas etapas" };

export default async function VerifyPage() {
  if (!(await hasPendingChallenge())) redirect("/login");
  return (
    <AuthShell>
      <TwoFactorForm />
    </AuthShell>
  );
}

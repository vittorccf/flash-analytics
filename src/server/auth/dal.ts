// Camada de acesso: toda página, Server Action e rota passa por aqui. O proxy só faz um redirecionamento
// otimista (cookie presente ou não); a decisão de acesso de verdade acontece neste arquivo, perto do dado.
import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "./session";
import { can, type Permission } from "@/lib/permissions";

export const getCurrentUser = async (): Promise<SessionUser | null> => (await getSession())?.user ?? null;

export const homeFor = (user: Pick<SessionUser, "role">) => (user.role === "ADMIN" ? "/admin" : "/contatos");

type RequireOptions = { allowPendingPasswordChange?: boolean };

export const requireUser = async (opts: RequireOptions = {}) => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Senha provisória: nada além da troca de senha até ela ser feita.
  if (user.mustChangePassword && !opts.allowPendingPasswordChange) redirect("/conta/senha");
  return user;
};

export const requireAdmin = async () => {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect(homeFor(user));
  return user;
};

export const requireOperator = async () => {
  const user = await requireUser();
  if (user.role !== "OPERATOR") redirect(homeFor(user));
  return user;
};

// Permissão sobre contatos (ver src/lib/permissions.ts). Sem ela, volta para a lista de contatos.
export const requirePermission = async (permission: Permission) => {
  const user = await requireUser();
  if (!can(user, permission)) redirect("/contatos?aviso=sem-permissao");
  return user;
};

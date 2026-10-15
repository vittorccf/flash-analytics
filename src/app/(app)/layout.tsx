import { requireUser } from "@/server/auth/dal";
import { unreadCount } from "@/server/notifications";
import { pendingSignupCount } from "@/server/signup-requests";
import { ROLE_LABELS } from "@/lib/labels";
import { AdminAlerts } from "@/components/realtime/admin-alerts";
import { ConnectionIndicator } from "@/components/realtime/connection-indicator";
import { LiveRefresh } from "@/components/realtime/live-refresh";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { Logo } from "@/components/brand";
import { logoutAction } from "./actions";
import { Nav } from "./nav";
import { cookies } from "next/headers";
import { Dialer } from "@/components/dialer";
import { SupportWidget } from "@/components/support-widget";
import { openSupportCount } from "@/server/support";
import { GlobalSearch } from "@/components/global-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { UserMenu } from "@/components/user-menu";
import { can } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // A troca obrigatória de senha também usa este layout; cada página aplica a regra completa.
  const user = await requireUser({ allowPendingPasswordChange: true });
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const isAdmin = user.role === "ADMIN" && !user.mustChangePassword;
  const [unread, pending, support] = isAdmin ? await Promise.all([unreadCount(user.id), pendingSignupCount(), openSupportCount()]) : [0, 0, 0];

  return (
    <RealtimeProvider enabled={!user.mustChangePassword}>
      {isAdmin ? (
        <>
          <AdminAlerts currentUserId={user.id} />
          {/* Contadores do menu acompanham notificações e solicitações novas. */}
          <LiveRefresh events={["contact.created", "contacts.imported", "signup.requested", "signup.decided", "support.created"]} />
        </>
      ) : null}
      <div className="flex min-h-screen flex-col md:flex-row">
        {/* A coluna escura acompanha a altura da página; o menu dentro dela fica fixo na rolagem. */}
        <div data-surface="dark" className="surface-sidebar text-sidebar-foreground md:w-64 md:shrink-0">
          <aside className="md:sticky md:top-0 md:flex md:h-screen md:flex-col">
            <div className="px-5 py-5">
              <Logo tone="dark" endorsed />
            </div>
            <Nav role={user.role} restricted={user.mustChangePassword} counts={{ pending, unread, support }} canCreate={can(user, "contacts.create")} />
          </aside>
        </div>
        <div className="canvas-glow flex min-w-0 flex-1 flex-col bg-no-repeat">
          <div aria-hidden className="brand-hairline h-0.5" />
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-3">
            <ConnectionIndicator />
            {/* Canto superior direito: busca de contatos, discador, tema e perfil. */}
            <div className="flex flex-1 items-center justify-end gap-2">
              {user.mustChangePassword ? null : (
                <>
                  <GlobalSearch />
                  <Dialer />
                </>
              )}
              <ThemeToggle initial={theme} />
              <UserMenu
                name={user.name}
                email={user.email}
                roleLabel={ROLE_LABELS[user.role]}
                showAccount={!user.mustChangePassword}
                logoutAction={logoutAction}
              />
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 p-6 lg:p-8">{children}</main>
        </div>
      </div>
      <SupportWidget signedIn />
    </RealtimeProvider>
  );
}

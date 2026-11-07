import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ImpersonationBar } from "@/components/app/impersonation-bar";
import { MobileTabBar, MobileTopBar } from "@/components/app/mobile-nav";
import { Notch } from "@/components/app/notch";
import { RouteTransition } from "@/components/motion/route-transition";
import { ScrollZone } from "@/components/motion/scroll-zone";
import { getAppShell } from "@/functions/app-shell";

/**
 * Coque de l'admin (DA v4) : sur grand écran, un cadre noir de 6 px autour de l'écran et le
 * notch de navigation en haut, au centre ; le contenu défile dans le cadre. Sur mobile, notch en
 * bas avec les onglets, et un lien de retour en haut des fiches. La coque reste en place d'une
 * page à l'autre : seul le contenu change.
 */
export const Route = createFileRoute("/app")({
  loader: () => getAppShell(),
  component: AppLayout,
});

function AppLayout() {
  const { user, workspace, pendingBookings, unreadNotifications, impersonating } =
    Route.useLoaderData();
  return (
    // Mobile : le haut de l'écran (encoche, application installée) reste libre.
    <div className="flex min-h-dvh flex-1 flex-col pt-[env(safe-area-inset-top)] lg:h-dvh lg:min-h-0 lg:flex-none lg:bg-ink lg:p-1.5">
      <Notch
        user={user}
        workspace={workspace}
        pendingBookings={pendingBookings}
        unreadNotifications={unreadNotifications}
      />
      <ScrollZone className="flex min-w-0 flex-1 flex-col scrollbar-none lg:relative lg:min-h-0 lg:overflow-y-auto lg:rounded-[10px] lg:bg-bg lg:pt-14">
        {impersonating && <ImpersonationBar name={user.name} />}
        <MobileTopBar />
        <main className="relative flex min-w-0 flex-1 flex-col lg:pb-4">
          <RouteTransition>
            <Outlet />
          </RouteTransition>
        </main>
        <MobileTabBar
          pendingBookings={pendingBookings}
          unreadNotifications={unreadNotifications}
          user={user}
          workspace={workspace}
        />
      </ScrollZone>
    </div>
  );
}

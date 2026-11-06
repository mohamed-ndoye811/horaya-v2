import { countPendingBookings, countUnreadNotifications } from "@horaya/db";
import { MobileTabBar, MobileTopBar } from "@/components/app/mobile-nav";
import { Notch } from "@/components/app/notch";
import { RouteTransition } from "@/components/motion/route-transition";
import { requireWorkspace } from "@/server/auth";
import { db } from "@/server/db";
import { requireMember } from "@/server/services";

/**
 * Coque de l'admin (DA v4) : sur grand écran, un cadre noir de 6 px autour de l'écran et le
 * notch de navigation en haut, au centre ; le contenu défile dans le cadre. Sur mobile, notch en
 * bas avec les onglets, et un lien de retour en haut des fiches.
 */
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const [{ user, workspace }, { memberId }] = await Promise.all([
    requireWorkspace(),
    requireMember(),
  ]);
  const [pendingBookings, unreadNotifications] = await Promise.all([
    countPendingBookings(db, workspace.id),
    countUnreadNotifications(db, memberId),
  ]);
  const firstName = user.firstName || user.name.split(" ")[0] || user.name;
  const lastInitial = user.lastName ? ` ${user.lastName.charAt(0)}.` : "";

  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:h-dvh lg:min-h-0 lg:flex-none lg:bg-ink lg:p-1.5">
      <Notch
        user={{ name: user.name, shortName: `${firstName}${lastInitial}` }}
        workspace={{ name: workspace.name }}
        pendingBookings={pendingBookings}
        unreadNotifications={unreadNotifications}
      />
      <div className="flex min-w-0 flex-1 flex-col lg:relative lg:min-h-0 lg:overflow-y-auto lg:rounded-[10px] lg:bg-bg lg:pt-14">
        <MobileTopBar />
        <main className="relative flex min-w-0 flex-1 flex-col lg:pb-4">
          <RouteTransition>{children}</RouteTransition>
        </main>
        <MobileTabBar pendingBookings={pendingBookings} />
      </div>
    </div>
  );
}

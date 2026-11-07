import { getCurrentPlan } from "@horaya/core";
import { countPendingBookings, countUnreadNotifications } from "@horaya/db";
import { createServerFn } from "@tanstack/react-start";
import { requireWorkspace } from "@/server/auth";
import { db } from "@/server/db";
import { isPlatformAdmin } from "@/server/platform";
import { deps, requireMember } from "@/server/services";

/** Ce que la coque de l'admin affiche (notch, capsule, grand menu mobile) ; renvoie vers la connexion sans session. */
export const getAppShell = createServerFn({ method: "GET" }).handler(async () => {
  const [{ user, session, workspace }, { memberId }] = await Promise.all([
    requireWorkspace(),
    requireMember(),
  ]);
  const [pendingBookings, unreadNotifications, current] = await Promise.all([
    countPendingBookings(db, workspace.id),
    countUnreadNotifications(db, memberId),
    getCurrentPlan(deps, workspace.id),
  ]);
  const firstName = user.firstName || user.name.split(" ")[0] || user.name;
  const lastInitial = user.lastName ? ` ${user.lastName.charAt(0)}.` : "";
  return {
    user: {
      name: user.name,
      shortName: `${firstName}${lastInitial}`,
      image: user.image ?? null,
      platformAdmin: isPlatformAdmin(user.email),
    },
    workspace: { name: workspace.name, slug: workspace.slug },
    pendingBookings,
    unreadNotifications,
    plan: current.plan,
    /** « Se connecter en tant que » en cours (équipe Horaya) : bandeau de retour. */
    impersonating: Boolean((session as { impersonatedBy?: string | null }).impersonatedBy),
  };
});

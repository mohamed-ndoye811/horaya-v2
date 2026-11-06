import { countPendingBookings, countUnreadNotifications } from "@horaya/db";
import { createServerFn } from "@tanstack/react-start";
import { requireWorkspace } from "@/server/auth";
import { db } from "@/server/db";
import { requireMember } from "@/server/services";

/** Ce que la coque de l'admin affiche (notch, capsule) ; renvoie vers la connexion sans session. */
export const getAppShell = createServerFn({ method: "GET" }).handler(async () => {
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
  return {
    user: { name: user.name, shortName: `${firstName}${lastInitial}`, image: user.image ?? null },
    workspace: { name: workspace.name },
    pendingBookings,
    unreadNotifications,
  };
});

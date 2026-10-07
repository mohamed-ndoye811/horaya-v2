import { countPendingBookings } from "@horaya/db";
import { Sidebar } from "@/components/app/sidebar";
import { requireWorkspace } from "@/server/auth";
import { db } from "@/server/db";

/** Coque de l'admin : navigation à gauche, contenu qui défile à droite. */
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const { user, workspace } = await requireWorkspace();
  const pendingBookings = await countPendingBookings(db, workspace.id);
  const firstName = user.firstName || user.name.split(" ")[0] || user.name;
  const lastInitial = user.lastName ? ` ${user.lastName.charAt(0)}.` : "";

  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <Sidebar
        user={{ name: user.name, shortName: `${firstName}${lastInitial}` }}
        workspace={{ name: workspace.name }}
        pendingBookings={pendingBookings}
      />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}

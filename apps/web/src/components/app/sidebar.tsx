"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { CountBadge } from "@/components/ui/badge";
import {
  BoxIcon,
  CalendarIcon,
  DashboardIcon,
  ReceiptIcon,
  SettingsIcon,
  TicketIcon,
  UserIcon,
} from "@/components/ui/icons";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Compteur rouge (réservations à valider). */
  badge?: number;
}

const MAIN_NAV: NavItem[] = [
  { href: "/app", label: "Tableau de bord", icon: DashboardIcon },
  { href: "/app/calendrier", label: "Calendrier", icon: CalendarIcon },
  { href: "/app/evenements", label: "Événements", icon: TicketIcon },
  { href: "/app/reservations", label: "Réservations", icon: ReceiptIcon },
  { href: "/app/materiel", label: "Matériel", icon: BoxIcon },
  { href: "/app/clients", label: "Clients", icon: UserIcon },
];

const SETTINGS: NavItem = { href: "/app/parametres", label: "Paramètres", icon: SettingsIcon };

function isActive(pathname: string, href: string) {
  return href === "/app"
    ? pathname === "/app"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 px-6 py-3 text-[15px] leading-5 transition-colors",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink",
        active ? "bg-ink font-bold text-on-ink" : "font-semibold text-ink hover:bg-draft-bg",
      )}
    >
      <Icon className="shrink-0" />
      <span className="grow">{item.label}</span>
      {item.badge ? (
        <CountBadge tone="danger">
          {item.badge}
          <span className="sr-only"> à valider</span>
        </CountBadge>
      ) : null}
    </Link>
  );
}

export interface SidebarProps {
  user: { name: string; shortName: string };
  workspace: { name: string };
  pendingBookings?: number;
}

function SidebarContent({
  user,
  workspace,
  pendingBookings,
  pathname,
}: SidebarProps & { pathname: string }) {
  const items = MAIN_NAV.map((item) =>
    item.href === "/app/reservations" ? { ...item, badge: pendingBookings } : item,
  );
  return (
    <div className="flex h-full flex-col justify-between pt-8 pb-6">
      <div className="flex flex-col gap-10">
        <Link href="/app" className="px-6 font-headline text-[36px] leading-9 text-ink">
          Horaya
        </Link>
        <nav aria-label="Navigation principale" className="flex flex-col">
          {items.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>
      </div>
      <div className="flex flex-col gap-2">
        <NavLink item={SETTINGS} pathname={pathname} />
        <div className="border-t border-line-soft px-3 pt-3">
          <AccountMenu user={user} workspace={workspace} />
        </div>
      </div>
    </div>
  );
}

/** Bloc du compte en bas de la navigation ; ouvre la déconnexion. */
function AccountMenu({ user, workspace }: Pick<SidebarProps, "user" | "workspace">) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.replace("/connexion");
    router.refresh();
  }

  return (
    <div className="relative">
      {open && (
        <div className="absolute right-0 bottom-full left-0 mb-2 border-2 border-ink bg-surface py-1 shadow-[4px_4px_0_var(--color-ink)]">
          <button
            type="button"
            onClick={signOut}
            disabled={pending}
            className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-ink hover:bg-draft-bg"
          >
            {pending ? "Déconnexion…" : "Se déconnecter"}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-1 text-left hover:bg-draft-bg"
      >
        <Avatar name={user.name} size="md" color="#66537C" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-bold leading-[18px] text-ink">
            {user.shortName}
          </span>
          <span className="truncate text-[13px] font-medium leading-4 text-ink-muted">
            {workspace.name}
          </span>
        </span>
      </button>
    </div>
  );
}

/** Navigation de l'admin sur grand écran : colonne fixe de 232 px (mobile : `mobile-nav`). */
export function Sidebar(props: SidebarProps) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 border-r-2 border-ink lg:block">
      <SidebarContent {...props} pathname={pathname} />
    </aside>
  );
}

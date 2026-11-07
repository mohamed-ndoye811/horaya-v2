"use client";

import { type ComponentType, useCallback, useEffect, useState } from "react";
import { ActiveIndicator } from "@/components/motion/indicator";
import {
  ArrowLeft,
  CalendarIcon,
  DashboardIcon,
  ReceiptIcon,
  TicketIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { backLink, isFormPage } from "@/lib/mobile-nav";
import { Link, usePathname } from "@/lib/navigation";
import { BottomNotch } from "./bottom-notch";
import { MobileMenu, type MobileMenuProps } from "./mobile-menu";

/*
 * Navigation mobile de l'admin (DA v4, maquettes 6.1 à 6.4) : un lien de retour en haut des
 * fiches, et le notch noir en bas de l'écran avec les onglets en icônes, sous un fondu ; le
 * dernier ouvre le grand menu. Masqués à partir de `lg`, où le notch du haut prend le relais.
 */

/**
 * Retour vers la liste ou la fiche parente (« ← Réservations »), hors onglets. Aussi sur grand
 * écran, sauf quand il mène à l'onglet Plus, propre au mobile.
 */
export function MobileTopBar() {
  const pathname = usePathname();
  const back = backLink(pathname);
  if (!back) return null;
  return (
    <div className={cn("px-4 pt-4", back.href === "/app/plus" && "lg:hidden")}>
      {/* Zone de toucher de 44 px de haut, sans décaler la page. */}
      <Link
        href={back.href}
        className="-mx-2 -my-3.5 flex w-fit items-center gap-1.5 px-2 py-3.5 text-[13px] font-semibold leading-4 text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3" />
        {back.label}
      </Link>
    </div>
  );
}

interface Tab {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  /** Chemins qui allument l'onglet. */
  match: (pathname: string) => boolean;
}

const startsWith = (prefix: string) => (pathname: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

const TABS: Tab[] = [
  { href: "/app", label: "Accueil", icon: DashboardIcon, match: (path) => path === "/app" },
  {
    href: "/app/calendrier",
    label: "Calendrier",
    icon: CalendarIcon,
    match: startsWith("/app/calendrier"),
  },
  {
    href: "/app/evenements",
    label: "Événements",
    icon: TicketIcon,
    match: startsWith("/app/evenements"),
  },
  {
    href: "/app/reservations",
    label: "Réservations",
    icon: ReceiptIcon,
    match: startsWith("/app/reservations"),
  },
];

/** Écrans rangés derrière l'onglet « Plus » : il s'allume avec eux. */
const MENU_PATHS = [
  "/app/plus",
  "/app/materiel",
  "/app/clients",
  "/app/parametres",
  "/app/design-system",
];

const tabClasses = (active: boolean) =>
  cn(
    "relative isolate flex size-[42px] items-center justify-center rounded-[14px] transition-colors",
    active ? "text-on-ink" : "text-notch-idle",
  );

/** Pastille orange d'un onglet (réservations à valider, notifications non lues). */
function TabDot() {
  return (
    <span
      aria-hidden="true"
      className="absolute top-[9px] right-[9px] size-[7px] rounded-full bg-accent"
    />
  );
}

function MoreDots({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

export function MobileTabBar({
  pendingBookings,
  unreadNotifications,
  user,
  workspace,
}: {
  pendingBookings: number;
  unreadNotifications: number;
} & Pick<MobileMenuProps, "user" | "workspace">) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(unreadNotifications);
  useEffect(() => setUnread(unreadNotifications), [unreadNotifications]);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const markRead = useCallback(() => setUnread(0), []);
  // Changement de page (lien du menu, recherche) : le menu se referme.
  // biome-ignore lint/correctness/useExhaustiveDependencies: déclenché par la navigation
  useEffect(() => setMenuOpen(false), [pathname]);

  // Formulaire : pas d'onglets, seulement la place de sa barre d'actions.
  if (isFormPage(pathname)) {
    return (
      <div aria-hidden="true" className="h-[calc(80px+env(safe-area-inset-bottom))] lg:hidden" />
    );
  }
  const moreActive = MENU_PATHS.some((prefix) => startsWith(prefix)(pathname));
  return (
    <>
      <BottomNotch label="Navigation principale">
        <ul className="flex w-full justify-between gap-1">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            const Icon = tab.icon;
            const pending = tab.href === "/app/reservations" && pendingBookings > 0;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={pending ? `${tab.label}, ${pendingBookings} à valider` : tab.label}
                  className={tabClasses(active)}
                >
                  {active && (
                    <ActiveIndicator
                      id="mobile-tab"
                      className="inset-0 -z-10 rounded-[14px] bg-on-ink/16"
                    />
                  )}
                  <Icon size={22} />
                  {pending && <TabDot />}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-label={
                unread > 0
                  ? `Plus, ${unread} notification${unread > 1 ? "s" : ""} non lue${unread > 1 ? "s" : ""}`
                  : "Plus"
              }
              className={tabClasses(moreActive)}
            >
              {moreActive && (
                <ActiveIndicator
                  id="mobile-tab"
                  className="inset-0 -z-10 rounded-[14px] bg-on-ink/16"
                />
              )}
              <MoreDots size={22} />
              {unread > 0 && <TabDot />}
            </button>
          </li>
        </ul>
      </BottomNotch>
      <MobileMenu
        open={menuOpen}
        onClose={closeMenu}
        user={user}
        workspace={workspace}
        unread={unread}
        onRead={markRead}
      />
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { Avatar } from "@/components/ui/avatar";
import { CountBadge } from "@/components/ui/badge";
import {
  CalendarIcon,
  ChevronLeft,
  DashboardIcon,
  MoreIcon,
  ReceiptIcon,
  TicketIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { backLink, isFormPage } from "@/lib/mobile-nav";

/*
 * Navigation mobile de l'admin (maquettes M5 à M25) : barre du haut avec le logo ou un
 * retour, et barre d'onglets fixée en bas. Masquées à partir de `lg`, où la colonne de
 * gauche prend le relais.
 */

export function MobileTopBar({ user }: { user: { name: string } }) {
  const pathname = usePathname();
  const back = backLink(pathname);
  return (
    <div className="flex h-14 items-center justify-between px-3 lg:hidden">
      {back ? (
        <Link
          href={back.href}
          className="flex h-10 items-center gap-2 px-2 text-[15px] font-bold leading-5 text-ink"
        >
          <ChevronLeft />
          {back.label}
        </Link>
      ) : (
        <Link href="/app" className="px-2 font-headline text-[28px] leading-7 text-ink">
          Horaya
        </Link>
      )}
      <Link href="/app/plus" aria-label="Compte et paramètres" className="p-1">
        <Avatar name={user.name} size="md" color="#66537C" />
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
  {
    href: "/app/plus",
    label: "Plus",
    icon: MoreIcon,
    match: (path) =>
      ["/app/plus", "/app/materiel", "/app/clients", "/app/parametres", "/app/design-system"].some(
        (prefix) => startsWith(prefix)(path),
      ),
  },
];

export function MobileTabBar({ pendingBookings }: { pendingBookings: number }) {
  const pathname = usePathname();
  // Formulaire : pas d'onglets, seulement la place de sa barre d'actions.
  if (isFormPage(pathname)) {
    return (
      <div aria-hidden="true" className="h-[calc(80px+env(safe-area-inset-bottom))] lg:hidden" />
    );
  }
  return (
    <>
      {/* Réserve la place de la barre fixe sous le contenu. */}
      <div aria-hidden="true" className="h-[calc(64px+env(safe-area-inset-bottom))] lg:hidden" />
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-bg pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="flex">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            const Icon = tab.icon;
            const badge = tab.href === "/app/reservations" ? pendingBookings : 0;
            return (
              <li key={tab.href} className="flex-1 basis-0">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-16 flex-col items-center justify-center gap-1 border-t-[3px]",
                    active
                      ? "border-ink font-extrabold text-ink"
                      : "border-transparent font-semibold text-ink-muted",
                  )}
                >
                  <Icon size={22} />
                  <span className="text-[11px] leading-[14px]">{tab.label}</span>
                  {badge > 0 && (
                    <span className="absolute top-1.5 left-[calc(50%+4px)]">
                      <CountBadge tone="danger">
                        {badge}
                        <span className="sr-only"> à valider</span>
                      </CountBadge>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

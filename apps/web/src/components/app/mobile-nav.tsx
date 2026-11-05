"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
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
import { BottomNotch } from "./bottom-notch";

/*
 * Navigation mobile de l'admin (DA v4, maquettes 6.1 à 6.4) : un lien de retour en haut des
 * fiches, et le notch noir en bas de l'écran avec les onglets en icônes, sous un fondu.
 * Masqués à partir de `lg`, où le notch du haut prend le relais.
 */

/** Retour vers la liste ou la fiche parente (« ← Réservations »), seulement hors onglets. */
export function MobileTopBar() {
  const pathname = usePathname();
  const back = backLink(pathname);
  if (!back) return null;
  return (
    <div className="px-4 pt-4 lg:hidden">
      <Link
        href={back.href}
        className="flex w-fit items-center gap-1.5 text-[13px] font-semibold leading-4 text-ink-muted"
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
  {
    href: "/app/plus",
    label: "Plus",
    icon: MoreDots,
    match: (path) =>
      ["/app/plus", "/app/materiel", "/app/clients", "/app/parametres", "/app/design-system"].some(
        (prefix) => startsWith(prefix)(path),
      ),
  },
];

function MoreDots({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

export function MobileTabBar({ pendingBookings }: { pendingBookings: number }) {
  const pathname = usePathname();
  // Formulaire : pas d'onglets, seulement la place de sa barre d'actions.
  if (isFormPage(pathname)) {
    return (
      <div aria-hidden="true" className="h-[calc(80px+env(safe-area-inset-bottom))] lg:hidden" />
    );
  }
  return (
    <BottomNotch label="Navigation principale">
      <ul className="mt-0.5 flex w-[226px] justify-between mx-auto">
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
                className={cn(
                  "relative isolate flex size-[42px] items-center justify-center rounded-[14px] transition-colors",
                  active ? "text-on-ink" : "text-notch-idle",
                )}
              >
                {active && (
                  <ActiveIndicator
                    id="mobile-tab"
                    className="inset-0 -z-10 rounded-[14px] bg-on-ink/16"
                  />
                )}
                <Icon size={22} />
                {pending && (
                  <span
                    aria-hidden="true"
                    className="absolute top-[9px] right-[9px] size-[7px] rounded-full bg-accent"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </BottomNotch>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, useState } from "react";
import { ActiveIndicator } from "@/components/motion/indicator";
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
import { initials } from "@/lib/format";
import { HorayaMark } from "./logo";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; size?: number }>;
}

const NAV: NavItem[] = [
  { href: "/app", label: "Tableau de bord", icon: DashboardIcon },
  { href: "/app/calendrier", label: "Calendrier", icon: CalendarIcon },
  { href: "/app/evenements", label: "Événements", icon: TicketIcon },
  { href: "/app/reservations", label: "Réservations", icon: ReceiptIcon },
  { href: "/app/materiel", label: "Matériel", icon: BoxIcon },
  { href: "/app/clients", label: "Clients", icon: UserIcon },
  { href: "/app/parametres", label: "Paramètres", icon: SettingsIcon },
];

function isActive(pathname: string, href: string) {
  return href === "/app"
    ? pathname === "/app"
    : pathname === href || pathname.startsWith(`${href}/`);
}

/*
 * Forme du notch (Paper « 0.1 · Notch · états ») : 600 × 56, courbes en S qui se fondent
 * dans le cadre noir de 6 px.
 */
const NOTCH_PATH = "M0 0 L0 6 C24 6 20 56 44 56 L556 56 C580 56 576 6 600 6 L600 0 Z";

export interface NotchProps {
  user: { name: string; shortName: string };
  workspace: { name: string };
  /** Réservations à valider : pastille orange sur l'icône. */
  pendingBookings: number;
}

/** Navigation de l'admin sur grand écran : le notch noir en haut, au centre (DA v4). */
export function Notch({ user, workspace, pendingBookings }: NotchProps) {
  const pathname = usePathname();
  return (
    <div
      data-tour="notch"
      className="fixed top-0 left-1/2 z-50 hidden h-14 w-[600px] -translate-x-1/2 lg:block"
    >
      <svg
        width="600"
        height="56"
        viewBox="0 0 600 56"
        aria-hidden="true"
        className="absolute inset-0"
      >
        <path d={NOTCH_PATH} className="fill-ink" />
      </svg>
      <div className="absolute inset-x-11 top-[3px] flex h-[50px] items-center justify-center gap-1.5">
        <Link
          href="/app"
          aria-label="Horaya, tableau de bord"
          className="flex size-9 items-center justify-center text-on-ink"
        >
          <HorayaMark size={22} />
        </Link>
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-[#3a3a3a]" />
        <nav aria-label="Navigation principale" className="flex items-center gap-1.5">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            const pending = item.href === "/app/reservations" && pendingBookings > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={pending ? `${item.label}, ${pendingBookings} à valider` : item.label}
                title={item.label}
                className={cn(
                  "relative isolate flex size-10 items-center justify-center rounded-xl transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-ink",
                  active ? "text-on-ink" : "text-notch-idle hover:text-on-ink",
                )}
              >
                {active && (
                  <ActiveIndicator id="notch" className="inset-0 -z-10 rounded-xl bg-on-ink/16" />
                )}
                <Icon size={20} />
                {pending && (
                  <span
                    aria-hidden="true"
                    className="absolute top-2 right-2 size-[7px] rounded-full bg-accent"
                  />
                )}
              </Link>
            );
          })}
        </nav>
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-[#3a3a3a]" />
        <AccountMenu user={user} workspace={workspace} />
      </div>
    </div>
  );
}

/** Avatar du notch : ouvre le compte (paramètres, déconnexion). */
function AccountMenu({ user, workspace }: Pick<NotchProps, "user" | "workspace">) {
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
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={`Compte de ${user.name}`}
        className="flex size-8 items-center justify-center rounded-full bg-linear-135 from-[#f7b27e] to-[#e8743b] text-xs font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-ink"
      >
        {initials(user.name)}
      </button>
      {open && (
        <>
          {/* Clic en dehors : on referme. */}
          <button
            type="button"
            aria-label="Fermer le menu du compte"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 -z-10 cursor-default"
          />
          <div className="absolute top-full right-0 mt-3 w-60 origin-top-right animate-pop rounded-2xl bg-surface p-2 shadow-[0_16px_40px_rgba(0,0,0,0.16)]">
            <div className="flex flex-col gap-0.5 px-3 pt-2 pb-3">
              <span className="truncate text-sm font-semibold leading-[18px] text-ink">
                {user.shortName}
              </span>
              <span className="truncate text-[13px] leading-4 text-ink-muted">
                {workspace.name}
              </span>
            </div>
            <Link
              href="/app/parametres"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-field"
            >
              Paramètres
            </Link>
            <button
              type="button"
              onClick={signOut}
              disabled={pending}
              className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-danger hover:bg-danger-bg"
            >
              {pending ? "Déconnexion…" : "Se déconnecter"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

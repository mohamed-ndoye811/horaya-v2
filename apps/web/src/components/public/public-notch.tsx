"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { WorkspaceMark } from "./public-chrome";

/**
 * Navigation des pages publiques : notch sombre en haut au centre sur grand écran (maquettes
 * 5.1 à 5.6), barre sombre en haut sur mobile.
 */
export function PublicNotch({
  workspace,
  contact,
}: {
  workspace: { name: string; slug: string };
  contact: string | null;
}) {
  const pathname = usePathname();
  const home = `/${workspace.slug}`;
  const bookings =
    pathname.startsWith(`${home}/mes-reservations`) || pathname.startsWith(`${home}/reservation/`);
  const legal = pathname.startsWith(`${home}/mentions-legales`);
  const links = [
    { label: "Événements", href: home, active: !bookings && !legal },
    { label: "Mes réservations", href: `${home}/mes-reservations`, active: bookings },
  ];
  const link = (active: boolean) =>
    cn(
      "flex h-9 items-center rounded-xl px-3 text-sm leading-[18px] transition-colors",
      active
        ? "bg-on-ink/15 font-semibold text-on-ink"
        : "font-medium text-notch-idle hover:text-on-ink",
    );

  const nav = (
    <>
      {links.map((entry) => (
        <Link
          key={entry.href}
          href={entry.href}
          aria-current={entry.active ? "page" : undefined}
          className={link(entry.active)}
        >
          {entry.label}
        </Link>
      ))}
      {contact && (
        <a href={contact} className={cn(link(false), "hidden sm:flex")}>
          Contact
        </a>
      )}
    </>
  );

  return (
    <>
      <div className="fixed top-0 left-1/2 z-50 hidden h-14 w-[600px] -translate-x-1/2 [view-transition-name:notch] lg:block">
        <svg
          aria-hidden="true"
          width="600"
          height="56"
          viewBox="0 0 600 56"
          className="absolute -top-1.5 left-0 fill-ink"
        >
          <path d="M0 0 L0 6 C24 6 20 56 44 56 L556 56 C580 56 576 6 600 6 L600 0 Z" />
        </svg>
        <nav
          aria-label="Navigation de l'espace"
          className="relative top-[3px] flex h-11 items-center justify-center gap-2 px-11"
        >
          <Link href={home} className="flex min-w-0 items-center gap-2 pr-1.5 text-on-ink">
            <WorkspaceMark name={workspace.name} />
            <span className="max-w-[170px] truncate text-[15px] font-semibold leading-[18px]">
              {workspace.name}
            </span>
          </Link>
          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-on-ink/15" />
          {nav}
        </nav>
      </div>

      <header className="flex items-center justify-between gap-3 px-4 pt-3 lg:hidden">
        <Link href={home} className="flex min-w-0 items-center gap-2 text-ink">
          <WorkspaceMark name={workspace.name} />
          <span className="truncate text-[15px] font-semibold leading-[18px]">
            {workspace.name}
          </span>
        </Link>
        <Link
          href={bookings ? home : `${home}/mes-reservations`}
          className="shrink-0 text-[13px] font-semibold leading-4 text-ink-muted"
        >
          {bookings ? "Événements" : "Mes réservations"}
        </Link>
      </header>
    </>
  );
}

"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Link, usePathname } from "@/lib/navigation";
import { WorkspaceMark } from "./public-chrome";

/** Lien du notch : pastille claire quand il est actif. */
export const notchLinkClasses = (active: boolean) =>
  cn(
    "flex h-9 items-center rounded-xl px-3 text-sm leading-[18px] transition-colors",
    active
      ? "bg-on-ink/15 font-semibold text-on-ink"
      : "font-medium text-notch-idle hover:text-on-ink",
  );

/** Notch sombre en haut au centre (grand écran) : la marque, un filet, puis les liens. */
export function NotchShell({
  label,
  brand,
  children,
}: {
  label: string;
  brand: ReactNode;
  children: ReactNode;
}) {
  return (
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
        aria-label={label}
        className="relative top-[3px] flex h-11 items-center justify-center gap-2 px-11"
      >
        {brand}
        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-on-ink/15" />
        {children}
      </nav>
    </div>
  );
}

/**
 * Navigation des pages publiques : notch sombre en haut au centre sur grand écran (maquettes
 * 5.1 à 5.6, 8.1 à 8.4), barre en haut sur mobile (8.6).
 */
export function PublicNotch({
  workspace,
  contact,
}: {
  workspace: { name: string; slug: string; logo: string | null };
  contact: string | null;
}) {
  const pathname = usePathname();
  const home = `/${workspace.slug}`;
  const space = `${home}/mon-espace`;
  const inSpace = pathname.startsWith(space) || pathname.startsWith(`${home}/reservation/`);
  const legal = pathname.startsWith(`${home}/mentions-legales`);
  const links = [
    { label: "Événements", href: home, active: !inSpace && !legal },
    { label: "Mon espace", href: space, active: inSpace },
  ];

  const mobileLink = "tap-area text-meta font-semibold leading-4 text-ink-muted hover:text-ink";

  return (
    <>
      <NotchShell
        label="Navigation de l'espace"
        brand={
          <Link href={home} className="flex min-w-0 items-center gap-2 pr-1.5 text-on-ink">
            <WorkspaceMark name={workspace.name} logo={workspace.logo} />
            <span className="max-w-[170px] truncate text-ui font-semibold leading-[18px]">
              {workspace.name}
            </span>
          </Link>
        }
      >
        {links.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            aria-current={entry.active ? "page" : undefined}
            className={notchLinkClasses(entry.active)}
          >
            {entry.label}
          </Link>
        ))}
        {contact && (
          <a href={contact} className={notchLinkClasses(false)}>
            Contact
          </a>
        )}
      </NotchShell>

      <header className="flex items-center justify-between gap-3 px-4 pt-3 lg:hidden">
        <Link href={home} className="flex min-w-0 items-center gap-2 text-ink">
          <WorkspaceMark name={workspace.name} logo={workspace.logo} />
          <span className="truncate text-ui font-semibold leading-[18px]">{workspace.name}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-4">
          {contact && !inSpace && (
            <a href={contact} className={mobileLink}>
              Contact
            </a>
          )}
          {/* Dans l'espace (8.6) : le profil ; ailleurs : l'espace. */}
          {pathname === space || pathname === `${space}/` ? (
            <Link href={`${space}/profil`} className={mobileLink}>
              Mon profil
            </Link>
          ) : inSpace ? (
            <Link href={home} className={mobileLink}>
              Événements
            </Link>
          ) : (
            <Link href={space} className={mobileLink}>
              Mon espace
            </Link>
          )}
        </div>
      </header>
    </>
  );
}

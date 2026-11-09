"use client";

import type { ReactNode } from "react";
import { NOTCH_BAR_HEIGHT, notchShape } from "@/components/app/notch-shape";
import { ActiveIndicator } from "@/components/motion/indicator";
import { cn } from "@/lib/cn";
import { Link, usePathname } from "@/lib/navigation";
import { WorkspaceMark } from "./public-chrome";

/** Lien du notch : même graisse actif ou non (le texte ne bouge pas), pastille `NotchActive`. */
export const notchLinkClasses = (active: boolean) =>
  cn(
    "relative isolate flex h-10 items-center rounded-xl px-3.5 text-sm font-semibold leading-[18px] transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-ink",
    active ? "text-on-ink" : "text-notch-idle hover:text-on-ink",
  );

/** Pastille du lien actif : elle glisse d'un lien à l'autre, comme dans le notch de l'admin. */
export function NotchActive() {
  return <ActiveIndicator id="public-notch" className="inset-0 -z-10 rounded-xl bg-on-ink/16" />;
}

/*
 * Les deux raccords du notch de l'admin (replié), coupés dans sa silhouette : à gauche la moitié
 * gauche d'un notch de 88 px, à droite sa moitié droite. Entre les deux, un aplat qui prend la
 * largeur des liens.
 */
const EARS = notchShape(88, NOTCH_BAR_HEIGHT, 0).d;

/**
 * Notch sombre en haut au centre (grand écran) : la marque, un filet, puis les liens. Même
 * silhouette que celui de l'admin, à la largeur de son contenu, et le même fondu dessous.
 */
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
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-1.5 top-1.5 z-40 hidden h-[72px] rounded-t-[10px] bg-linear-to-t from-bg/0 via-bg via-50% to-bg [view-transition-name:notch-fade] lg:block"
      />
      <div className="fixed top-0 left-1/2 z-50 hidden h-14 -translate-x-1/2 [view-transition-name:notch] lg:flex">
        <svg
          aria-hidden="true"
          width="44"
          height="56"
          viewBox="0 0 44 56"
          className="shrink-0 fill-ink"
        >
          <path d={EARS} />
        </svg>
        {/* Recouvre d'un pixel les raccords : pas de jour entre les morceaux. */}
        <nav aria-label={label} className="-mx-px flex h-14 bg-ink pt-[3px]">
          <div className="flex h-[50px] items-center gap-1.5">
            {brand}
            <span aria-hidden="true" className="mx-1.5 h-5 w-px shrink-0 bg-white/22" />
            {children}
          </div>
        </nav>
        <svg
          aria-hidden="true"
          width="44"
          height="56"
          viewBox="44 0 44 56"
          className="shrink-0 fill-ink"
        >
          <path d={EARS} />
        </svg>
      </div>
    </>
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
            {entry.active && <NotchActive />}
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

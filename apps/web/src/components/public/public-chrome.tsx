import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { textOn } from "@/lib/colors";

/** Variables de marque de l'espace : fond de l'en-tête et texte lisible dessus. */
export function brandStyle(color: string): CSSProperties {
  return { "--brand": color, "--on-brand": textOn(color) } as CSSProperties;
}

/** Filet clair sur la couleur de marque (25 % du texte). */
export const brandRule = "border-[color-mix(in_srgb,var(--on-brand)_25%,transparent)]";

export function WorkspaceMark({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center bg-[var(--on-brand)] font-headline text-[var(--brand)]",
        size === "md" ? "size-9 text-xl" : "size-5 text-label",
      )}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** Barre du haut des pages publiques (écrans 27, 10, 18, 19). */
export function PublicNav({
  workspace,
  active,
  aside,
}: {
  workspace: { name: string; slug: string };
  active?: "events" | "bookings";
  /** Remplace les liens (« Paiement sécurisé » pendant la réservation). */
  aside?: ReactNode;
}) {
  const link = (current: boolean) =>
    cn(
      "tap-area text-[15px] leading-5 text-[var(--on-brand)] underline-offset-[3px] hover:underline",
      current ? "font-extrabold underline decoration-1" : "font-semibold",
    );
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-16 sm:py-5",
        brandRule,
      )}
    >
      <Link
        href={`/${workspace.slug}`}
        className="flex min-w-0 items-center gap-3 text-[var(--on-brand)]"
      >
        <WorkspaceMark name={workspace.name} />
        <span className="truncate text-[17px] font-extrabold uppercase leading-[22px] tracking-[0.02em]">
          {workspace.name}
        </span>
      </Link>
      {aside ?? (
        <nav
          aria-label="Navigation de l'espace"
          className="flex shrink-0 items-center gap-5 sm:gap-8"
        >
          <Link
            href={`/${workspace.slug}`}
            aria-current={active === "events" ? "page" : undefined}
            className={cn(link(active === "events"), "hidden sm:inline")}
          >
            Tous les événements
          </Link>
          <Link
            href={`/${workspace.slug}/mes-reservations`}
            aria-current={active === "bookings" ? "page" : undefined}
            className={link(active === "bookings")}
          >
            Mes réservations
          </Link>
        </nav>
      )}
    </div>
  );
}

/** Pied des pages publiques : « © année Espace · Mentions légales · Contact » (écran 18). */
export function PublicFooter({
  workspace,
}: {
  workspace: {
    name: string;
    slug: string;
    contactEmail: string | null;
    contactPhone: string | null;
  };
}) {
  const contact = workspace.contactEmail
    ? `mailto:${workspace.contactEmail}`
    : workspace.contactPhone
      ? `tel:${workspace.contactPhone.replace(/[^+\d]/g, "")}`
      : null;
  const link = "tap-area hover:text-ink hover:underline underline-offset-[3px]";
  return (
    <footer className="flex flex-col-reverse gap-3 border-t-2 border-ink px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-16">
      <p className="text-sm font-semibold text-ink-muted">
        © {new Date().getFullYear()} {workspace.name} ·{" "}
        <Link href={`/${workspace.slug}/mentions-legales`} className={link}>
          Mentions légales
        </Link>
        {contact && (
          <>
            {" · "}
            <a href={contact} className={link}>
              Contact
            </a>
          </>
        )}
      </p>
      <Link href="/" className="tap-area flex items-center gap-2 text-ink">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.5px] text-ink-muted">
          Propulsé par
        </span>
        <span className="font-headline text-lg leading-[18px]">Horaya</span>
      </Link>
    </footer>
  );
}

/** Bandeau aux couleurs de l'espace (barre + titre de la page). */
export function BrandBand({ children }: { children: ReactNode }) {
  return (
    <header className="flex flex-col bg-[var(--brand)] text-[var(--on-brand)]">{children}</header>
  );
}

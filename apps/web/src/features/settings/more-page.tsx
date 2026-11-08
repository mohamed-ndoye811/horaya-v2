import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { inkCardClasses } from "@/components/ui/section";
import type { getMoreMenu } from "@/functions/settings";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { Link } from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/roles";
import { SignOutButton } from "./sign-out-button";

/**
 * Maquette 6.4 : ancienne page de l'onglet « Plus » (l'onglet ouvre désormais le grand menu,
 * mobile-menu.tsx) ; gardée pour les liens directs et les retours des écrans qu'elle range.
 */
export function MorePage({ data }: { data: Awaited<ReturnType<typeof getMoreMenu>> }) {
  const { userName, userImage, role, workspace, members } = data;

  return (
    <div className="flex flex-col gap-[18px] px-4 pt-4">
      <div className={cn(inkCardClasses, "flex items-center gap-3 rounded-[22px] p-3.5")}>
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-base font-bold text-on-ink"
        >
          {userImage ? (
            <img src={userImage} alt="" className="size-full rounded-full object-cover" />
          ) : (
            initials(userName)
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="truncate text-base font-semibold leading-5">{userName}</h1>
          <p className="truncate text-xs leading-4 text-on-ink-muted">
            {`${ROLE_LABELS[role]} · `}
            {workspace.name}
          </p>
        </div>
        <ButtonLink href="/app/parametres/profil" variant="inverse-outline" size="xs">
          Profil
        </ButtonLink>
      </div>

      <Group title="Gérer">
        <Row href="/app/materiel">Matériel</Row>
        <Row href="/app/clients">Clients</Row>
        <Row href="/app/bons-cadeaux">Bons cadeaux</Row>
        <Row href="/app/evenements/types">Types d'événements</Row>
        <Row href="/app/evenements/liens">Liens calendrier</Row>
        <Row href="/app/cartes">Cartes de séances</Row>
        <Row
          href={`/${workspace.slug}`}
          aside={<span className="text-[13px] font-semibold text-ink-subtle">↗</span>}
          chevron={false}
        >
          Ma page publique
        </Row>
      </Group>

      <Group title="Paramètres">
        <Row href="/app/parametres/profil">Profil</Row>
        <Row href="/app/parametres/organisation">Organisation &amp; marque</Row>
        <Row
          href="/app/parametres/membres"
          aside={<span className="font-mono text-[11px] text-ink-subtle">{members}</span>}
        >
          Membres &amp; rôles
        </Row>
        <Row href="/app/parametres/paiements">Paiements</Row>
        <Row href="/app/parametres/bons-cadeaux">Bons cadeaux</Row>
        <Row href="/app/parametres/abonnement">Abonnement</Row>
        <Row href="/app/parametres/notifications">Notifications</Row>
        <Row
          href="/app/parametres/integrations"
          aside={
            <StatusBadge tone="neutral" size="sm">
              Bientôt
            </StatusBadge>
          }
          chevron={false}
        >
          Intégrations
        </Row>
      </Group>

      <SignOutButton />
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="pl-1 text-xs font-bold leading-4 text-ink-muted">{title}</h2>
      <ul className="flex flex-col rounded-[20px] bg-surface px-4">{children}</ul>
    </section>
  );
}

function Row({
  href,
  aside,
  chevron = true,
  children,
}: {
  href: string;
  aside?: ReactNode;
  chevron?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="border-t border-line-faint first:border-t-0">
      <Link href={href} className="flex h-12 items-center justify-between gap-3 text-ink">
        <span className="text-[15px] font-medium leading-5">{children}</span>
        <span className="flex items-center gap-2">
          {aside}
          {chevron && (
            <span aria-hidden="true" className="text-base leading-4 text-ink-faint">
              ›
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

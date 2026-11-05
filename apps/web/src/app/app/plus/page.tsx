import { listTeam } from "@horaya/db";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { initials } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "Plus · Horaya" };

/**
 * Maquette 6.4 : onglet « Plus » de la navigation mobile. Mène à ce que les onglets
 * n'affichent pas (matériel, clients, types, liens, paramètres) et au compte.
 */
export default async function MorePage() {
  const { user, workspace, actor } = await getWorkspaceContext();
  const { members } = await listTeam(db, workspace.id, new Date());

  return (
    <div className="flex flex-col gap-[18px] px-4 pt-4">
      <div className="flex items-center gap-3 rounded-[22px] bg-ink p-3.5">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-linear-135 from-[#f7b27e] to-[#e8743b] text-base font-bold text-white"
        >
          {initials(user.name)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="truncate text-base font-semibold leading-5 text-white">{user.name}</h1>
          <p className="truncate text-xs leading-4 text-[#9a9ea8]">
            {actor.type === "member" ? `${ROLE_LABELS[actor.role]} · ` : ""}
            {workspace.name}
          </p>
        </div>
        <Link
          href="/app/parametres/profil"
          className="flex h-8 shrink-0 items-center rounded-full border border-draft px-3 text-xs font-semibold text-white"
        >
          Profil
        </Link>
      </div>

      <Group title="Gérer">
        <Row href="/app/materiel">Matériel</Row>
        <Row href="/app/clients">Clients</Row>
        <Row href="/app/evenements/types">Types d'événements</Row>
        <Row href="/app/evenements/liens">Liens calendrier</Row>
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
          aside={<span className="font-mono text-[11px] text-ink-subtle">{members.length}</span>}
        >
          Membres &amp; rôles
        </Row>
        <Row href="/app/parametres/paiements">Paiements &amp; notifications</Row>
        <Row
          href="/app/parametres/integrations"
          aside={
            <span className="rounded-full bg-[#f2f2f0] px-2 py-0.5 text-[11px] font-bold leading-[14px] text-ink-subtle">
              Bientôt
            </span>
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
    <li className="border-t border-[#f4f4f2] first:border-t-0">
      <Link href={href} className="flex h-12 items-center justify-between gap-3 text-ink">
        <span className="text-[15px] font-medium leading-5">{children}</span>
        <span className="flex items-center gap-2">
          {aside}
          {chevron && (
            <span aria-hidden="true" className="text-base leading-4 text-[#c4c4c0]">
              ›
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

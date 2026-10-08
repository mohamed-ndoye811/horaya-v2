import { addDays } from "@horaya/core";
import { getCustomerStats, getInventoryStats, listEventTypes } from "@horaya/db";
import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { CountBadge } from "@/components/ui/badge";
import { BoxIcon, ChevronRight, ExternalIcon, TicketIcon, UserIcon } from "@/components/ui/icons";
import { Eyebrow } from "@/components/ui/section";
import { addMonths, startOfDay, todayIn } from "@/lib/dates";
import { ROLE_LABELS } from "@/lib/roles";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "Plus · Horaya" };

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

/**
 * Maquette M18 : onglet « Plus » de la navigation mobile. Mène à ce que la barre
 * d'onglets n'affiche pas (matériel, clients, types, paramètres) et au compte.
 */
export default async function MorePage() {
  const { user, workspace, actor, timeZone } = await getWorkspaceContext();
  const now = new Date();
  const today = todayIn(timeZone, now);
  const monthStart = startOfDay({ ...today, day: 1 }, timeZone);

  const [inventory, customers, types] = await Promise.all([
    getInventoryStats(db, workspace.id, {
      now,
      dayEnd: startOfDay(addDays(today, 1), timeZone),
      monthStart,
      previousMonthStart: startOfDay(addMonths({ ...today, day: 1 }, -1), timeZone),
    }),
    getCustomerStats(db, workspace.id, monthStart),
    listEventTypes(db, workspace.id),
  ]);

  return (
    <div className="flex flex-col pb-6">
      <div className="flex items-center gap-3.5 border-b-2 border-ink px-5 pt-4 pb-5">
        <Avatar name={user.name} size="lg" color="#66537C" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-lg font-extrabold leading-[22px] text-ink">{user.name}</p>
          <p className="truncate text-sm font-medium leading-[18px] text-ink-muted">
            {actor.type === "member" ? `${ROLE_LABELS[actor.role]} · ` : ""}
            {workspace.name}
          </p>
        </div>
      </div>

      <section aria-labelledby="gerer" className="flex flex-col px-5 pt-6">
        <h2 id="gerer" className="border-b-2 border-ink pb-2.5">
          <Eyebrow>Gérer</Eyebrow>
        </h2>
        <BigRow
          href="/app/materiel"
          icon={BoxIcon}
          title="Matériel"
          detail={`${plural(inventory.items, "article")}${inventory.maintenanceUnits > 0 ? ` · ${inventory.maintenanceUnits} en maintenance` : ""}`}
          badge={inventory.maintenanceUnits > 0 ? inventory.maintenanceUnits : undefined}
        />
        <BigRow
          href="/app/clients"
          icon={UserIcon}
          title="Clients"
          detail={`${plural(customers.total, "client")} · ${customers.newThisMonth} nouveau${customers.newThisMonth > 1 ? "x" : ""} ce mois-ci`}
        />
        <BigRow
          href="/app/evenements/types"
          icon={TicketIcon}
          title="Types d'événements"
          detail={plural(types.length, "type")}
        />
        <BigRow
          href={`/${workspace.slug}`}
          icon={ExternalIcon}
          title="Ma page publique"
          detail={<span className="font-mono text-xs">horaya.app/{workspace.slug}</span>}
        />
      </section>

      <section aria-labelledby="parametres" className="flex flex-col px-5 pt-7">
        <h2 id="parametres" className="border-b-2 border-ink pb-2.5">
          <Eyebrow>Paramètres</Eyebrow>
        </h2>
        <SmallRow href="/app/parametres/profil">Profil</SmallRow>
        <SmallRow href="/app/parametres/organisation">Organisation &amp; marque</SmallRow>
        <SmallRow href="/app/parametres/membres">Membres &amp; rôles</SmallRow>
        <SmallRow href="/app/parametres/paiements">Paiements &amp; notifications</SmallRow>
        <SmallRow href="/app/parametres/integrations">Intégrations</SmallRow>
      </section>

      <div className="px-5 pt-7">
        <SignOutButton />
      </div>
    </div>
  );
}

function BigRow({
  href,
  icon: Icon,
  title,
  detail,
  badge,
}: {
  href: string;
  icon: ComponentType<{ size?: number }>;
  title: string;
  detail: ReactNode;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 border-b border-line-soft py-4 text-ink hover:bg-surface"
    >
      <Icon size={22} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[17px] font-bold leading-[22px]">{title}</span>
        <span className="truncate text-[13px] font-medium leading-[17px] text-ink-muted">
          {detail}
        </span>
      </span>
      {badge !== undefined && <CountBadge>{badge}</CountBadge>}
      <ChevronRight />
    </Link>
  );
}

function SmallRow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between border-b border-line-soft py-[15px] text-base font-semibold leading-5 text-ink hover:bg-surface"
    >
      {children}
      <ChevronRight />
    </Link>
  );
}

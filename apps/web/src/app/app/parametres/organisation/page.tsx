import { can } from "@horaya/core";
import { getWorkspaceSettings, listPublicUpcomingEvents, listTeam } from "@horaya/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SettingsShell } from "@/components/app/settings-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { formatDayNumber, formatMoney, formatMonthShort } from "@/lib/format";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { OrganizationForm } from "./organization-form";

export const metadata: Metadata = { title: "Organisation & marque · Horaya" };

/** Écran 24 : identité de l'espace et marque de la page publique. */
export default async function OrganizationSettingsPage() {
  const { workspace, actor, timeZone } = await getWorkspaceContext();
  const now = new Date();
  const [settings, events, team] = await Promise.all([
    getWorkspaceSettings(db, workspace.id),
    listPublicUpcomingEvents(db, workspace.id, now),
    listTeam(db, workspace.id, now),
  ]);
  if (!settings) notFound();
  const editable = actor.type === "member" && can(actor.role, "settings", "update");
  const members = team.members.length;

  return (
    <SettingsShell
      section="organisation"
      breadcrumb="Organisation & marque"
      subtitle={`Ton espace ${settings.name} · ${members} membre${members > 1 ? "s" : ""}`}
      actions={
        editable ? (
          <>
            <ButtonLink href="/app/parametres/organisation" variant="secondary">
              Annuler
            </ButtonLink>
            <Button type="submit" form="organization-form">
              Enregistrer
            </Button>
          </>
        ) : undefined
      }
    >
      <OrganizationForm
        editable={editable}
        initial={{
          name: settings.name,
          slug: settings.slug,
          brandColor: settings.brandColor,
          displayFont: settings.displayFont,
          description: settings.description ?? "",
          contactEmail: settings.contactEmail ?? "",
          contactPhone: settings.contactPhone ?? "",
          address: settings.address ?? "",
          legalName: settings.legalName ?? "",
          siret: settings.siret ?? "",
        }}
        events={events.map((entry) => ({
          id: entry.id,
          title: entry.title,
          month: formatMonthShort(entry.startsAt, timeZone),
          day: formatDayNumber(entry.startsAt, timeZone),
          price: entry.priceCents > 0 ? formatMoney(entry.priceCents) : "Gratuit",
        }))}
      />
    </SettingsShell>
  );
}

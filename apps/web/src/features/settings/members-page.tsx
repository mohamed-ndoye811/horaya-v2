import { SettingsShell } from "@/components/app/settings-shell";
import { cardClasses } from "@/components/ui/section";
import type { getMembersSettings } from "@/functions/settings";
import { cn } from "@/lib/cn";
import { InviteMemberButton, JoinLinkButton, TeamTable } from "./team";

const ROLE_RIGHTS: Array<{ role: string; can: string[]; cannot: string }> = [
  {
    role: "Admin",
    can: [
      "Tout gérer : événements, réservations, matériel",
      "Marque, réglages des paiements et membres",
    ],
    cannot: "Supprimer l'espace (propriétaire)",
  },
  {
    role: "Éditeur",
    can: ["Créer et publier des événements", "Valider les réservations"],
    cannot: "Paiements et membres",
  },
  {
    role: "Lecteur",
    can: ["Consulter le calendrier", "Voir les réservations"],
    cannot: "Aucune modification",
  },
];

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

/** Écran 25 : membres de l'espace, invitations et rôles. */
export function MembersSettingsPage({
  data,
}: {
  data: Awaited<ReturnType<typeof getMembersSettings>>;
}) {
  const { manageable, link, rows, membersCount, invitationsCount } = data;
  return (
    <SettingsShell
      section="membres"
      breadcrumb="Membres & rôles"
      subtitle={
        <>
          {plural(membersCount, "membre")} actif{membersCount > 1 ? "s" : ""}.{" "}
          <span className="text-ink">{plural(invitationsCount, "invitation")} en attente.</span>
        </>
      }
      actions={
        manageable ? (
          <>
            <JoinLinkButton link={link} />
            <InviteMemberButton />
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <TeamTable rows={rows} manageable={manageable} />
        <section className={cn(cardClasses, "gap-4")}>
          <h2 className="text-lg font-semibold leading-[22px] text-ink">
            Ce que chaque rôle peut faire
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {ROLE_RIGHTS.map((entry) => (
              <div
                key={entry.role}
                className="flex flex-col gap-2.5 rounded-2xl bg-field px-4 py-4"
              >
                <h3 className="text-base font-semibold text-ink">{entry.role}</h3>
                <ul className="flex flex-col gap-2">
                  {entry.can.map((line) => (
                    <li key={line} className="text-[13px] leading-[18px] text-ink">
                      <span className="mr-1 font-bold text-success">✓</span>
                      {line}
                    </li>
                  ))}
                  <li className="text-[13px] leading-[18px] text-ink-subtle">✕ {entry.cannot}</li>
                </ul>
              </div>
            ))}
          </div>
          <p className="text-xs leading-4 text-ink-subtle">
            Le propriétaire a tous les droits d'un admin, plus l'abonnement, la connexion des
            paiements en ligne et la suppression de l'espace.
          </p>
        </section>
      </div>
    </SettingsShell>
  );
}

import { getJoinLink, listTeam } from "@horaya/db";
import type { Metadata } from "next";
import { SettingsShell } from "@/components/app/settings-shell";
import { formatHour } from "@/lib/format";
import { canManageTeam } from "@/lib/roles";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getWorkspaceContext } from "@/server/workspace";
import {
  InviteMemberButton,
  JoinLinkButton,
  type JoinLinkView,
  type TeamRow,
  TeamTable,
} from "./team";

export const metadata: Metadata = { title: "Membres & rôles · Horaya" };

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

function since(date: Date, now: Date): string {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "invitée aujourd'hui";
  return days === 1 ? "invitée hier" : `invitée il y a ${days} jours`;
}

/** Écran 25 : membres de l'espace, invitations et rôles. */
export default async function MembersSettingsPage() {
  const { workspace, actor, timeZone } = await getWorkspaceContext();
  const now = new Date();
  const manageable = actor.type === "member" && canManageTeam(actor.role);
  const [{ members, invitations }, joinLink] = await Promise.all([
    listTeam(db, workspace.id, now),
    manageable ? getJoinLink(db, workspace.id) : null,
  ]);
  const link: JoinLinkView | null =
    joinLink && joinLink.expiresAt > now && joinLink.role !== "owner"
      ? {
          url: new URL(`/rejoindre/${joinLink.token}`, env.BETTER_AUTH_URL).toString(),
          role: joinLink.role,
          validUntil: `jusqu'au ${new Intl.DateTimeFormat("fr-FR", {
            day: "numeric",
            month: "long",
            timeZone,
          }).format(joinLink.expiresAt)}, ${formatHour(joinLink.expiresAt, timeZone)}`,
        }
      : null;
  const myMemberId = actor.type === "member" ? actor.memberId : null;

  const rows: TeamRow[] = [
    ...members.map((entry) => ({
      id: entry.id,
      kind: "member" as const,
      name: entry.name,
      email: entry.email,
      role: entry.role,
      isMe: entry.id === myMemberId,
    })),
    ...invitations.map((entry) => ({
      id: entry.id,
      kind: "invitation" as const,
      name:
        entry.email
          .split("@")[0]
          ?.replace(/[._-]+/g, " ")
          .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()) ?? entry.email,
      email: entry.email,
      role: entry.role,
      detail: since(entry.createdAt, now),
      isMe: false,
    })),
  ];
  const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

  return (
    <SettingsShell
      section="membres"
      breadcrumb="Membres & rôles"
      subtitle={`${plural(members.length, "membre")} actif${members.length > 1 ? "s" : ""} · ${plural(invitations.length, "invitation")} en attente`}
      actions={
        manageable ? (
          <>
            <JoinLinkButton link={link} />
            <InviteMemberButton />
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-8">
        <TeamTable rows={rows} manageable={manageable} />
        <section className="flex flex-col gap-3.5">
          <h2 className="border-b-2 border-ink pb-2.5 font-section text-section leading-7 text-ink">
            Ce que chaque rôle peut faire
          </h2>
          <div className="grid border-2 border-ink md:grid-cols-3">
            {ROLE_RIGHTS.map((entry, index) => (
              <div
                key={entry.role}
                className={`flex flex-col gap-2.5 px-[18px] py-4 ${index > 0 ? "border-t-2 border-ink md:border-t-0 md:border-l-2" : ""}`}
              >
                <h3 className="text-base font-extrabold text-ink">{entry.role}</h3>
                <ul className="flex flex-col gap-2.5">
                  {entry.can.map((line) => (
                    <li key={line} className="text-sm font-medium leading-5 text-ink">
                      ✓ {line}
                    </li>
                  ))}
                  <li className="text-sm font-medium leading-5 text-ink-subtle">
                    ✕ {entry.cannot}
                  </li>
                </ul>
              </div>
            ))}
          </div>
          <p className="text-[13px] font-medium text-ink-muted">
            Le propriétaire a tous les droits d'un admin, plus l'abonnement, la connexion des
            paiements en ligne et la suppression de l'espace.
          </p>
        </section>
      </div>
    </SettingsShell>
  );
}

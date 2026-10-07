import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusIcon } from "@/components/ui/icons";
import { requireWorkspace } from "@/server/auth";
import { VerifyEmailBanner } from "./account-actions";

export const metadata: Metadata = { title: "Tableau de bord · Horaya" };

/** Tableau de bord : provisoire jusqu'aux écrans admin (lot 5). */
export default async function DashboardPage() {
  const { user, workspace } = await requireWorkspace();
  const firstName = user.firstName || user.name.split(" ")[0] || "";
  const today = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(new Date());

  return (
    <>
      <PageHeader
        eyebrow={today}
        title={`Bonjour, ${firstName}`}
        subtitle={`Bienvenue dans ${workspace.name}.`}
        actions={
          <ButtonLink href="/app/design-system" variant="secondary">
            Voir le design system
          </ButtonLink>
        }
      />
      {!user.emailVerified && (
        <div className="px-4 pt-6 sm:px-10">
          <VerifyEmailBanner email={user.email} />
        </div>
      )}
      <EmptyState
        title="Rien à l'agenda. Pour l'instant."
        description="Crée ton premier événement : il apparaîtra dans ton calendrier et sur ta page publique, prêt à recevoir des réservations."
        actions={
          <ButtonLink href="/app/evenements" icon={<PlusIcon />}>
            Créer mon premier événement
          </ButtonLink>
        }
        steps={["Crée un événement", "Partage ta page publique", "Reçois tes réservations"]}
      />
    </>
  );
}

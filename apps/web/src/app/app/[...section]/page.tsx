import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Bientôt · Horaya" };

const TITLES: Record<string, string> = {
  calendrier: "Calendrier",
  evenements: "Événements",
  reservations: "Réservations",
  materiel: "Matériel",
  clients: "Clients",
  parametres: "Paramètres",
};

/** Écrans de l'admin pas encore livrés (lot 5) : la navigation reste utilisable. */
export default async function UpcomingSectionPage({ params }: PageProps<"/app/[...section]">) {
  const { section } = await params;
  const title = TITLES[section[0] ?? ""] ?? "Bientôt";
  return (
    <>
      <PageHeader eyebrow={`Tableau de bord / ${title}`} title={title} />
      <EmptyState
        title="Écran en construction."
        description="Cet écran arrive avec la prochaine livraison. En attendant, tu peux parcourir le design system de l'admin."
        actions={
          <ButtonLink href="/app/design-system" arrow>
            Voir le design system
          </ButtonLink>
        }
      />
    </>
  );
}

import { hasFeature, type PlanFeature } from "@horaya/core";
import { getRouteApi } from "@tanstack/react-router";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const app = getRouteApi("/app");

/** La formule de l'espace donne-t-elle accès à cette fonctionnalité ? (le serveur vérifie aussi) */
export function usePlanFeature(feature: PlanFeature): boolean {
  return hasFeature(app.useLoaderData().plan, feature);
}

const COPY: Record<Exclude<PlanFeature, "whiteLabel">, { title: string; description: string }> = {
  inventory: {
    title: "Le matériel est dans la formule Pro.",
    description:
      "Suis tes articles exemplaire par exemplaire, loue-les et attribue-les aux séances. Ce que tu as déjà ajouté reste consultable.",
  },
  counter: {
    title: "Le comptoir est dans la formule Pro.",
    description:
      "Prends une réservation au téléphone ou sur place en un écran : client, places, matériel et paiement.",
  },
};

/** À la place d'un écran réservé aux formules payantes. */
export function PlanUpsell({ feature }: { feature: Exclude<PlanFeature, "whiteLabel"> }) {
  return (
    <EmptyState
      title={COPY[feature].title}
      description={COPY[feature].description}
      actions={
        <ButtonLink href="/app/parametres/abonnement" arrow>
          Voir les formules
        </ButtonLink>
      }
    />
  );
}

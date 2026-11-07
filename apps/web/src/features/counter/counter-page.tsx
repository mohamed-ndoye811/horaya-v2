import { PageHeader } from "@/components/app/page-header";
import { PlanUpsell, usePlanFeature } from "@/components/app/plan-upsell";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { getCounter } from "@/functions/counter";
import { CounterWizard } from "./counter-wizard";

/**
 * Comptoir (maquette 1.6b) : une réservation prise au téléphone ou sur place, sur un seul
 * écran. Remplace l'ancien formulaire « Nouvelle réservation ».
 */
export function CounterPage({
  data,
  initialEventId,
}: {
  data: Awaited<ReturnType<typeof getCounter>>;
  initialEventId: string | undefined;
}) {
  const allowed = usePlanFeature("counter");
  return (
    <>
      <PageHeader
        eyebrow="Réservations / Comptoir"
        title="Comptoir"
        subtitle={
          <>
            Une réservation prise au téléphone ou sur place,{" "}
            <span className="text-ink">sur un seul écran.</span>
          </>
        }
      />
      {!allowed ? (
        <PlanUpsell feature="counter" />
      ) : data.events.length === 0 ? (
        <EmptyState
          title="Aucune séance ouverte."
          description="Publie d'abord un événement à venir : il apparaîtra ici pour y inscrire quelqu'un."
          actions={
            <ButtonLink href="/app/evenements" arrow>
              Voir mes événements
            </ButtonLink>
          }
        />
      ) : (
        <CounterWizard
          events={data.events}
          initialEventId={initialEventId}
          initialCustomer={data.initialCustomer}
        />
      )}
    </>
  );
}

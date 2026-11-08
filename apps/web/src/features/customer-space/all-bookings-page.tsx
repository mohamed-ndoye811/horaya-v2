import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import type { getAllCustomerBookings } from "@/functions/customer-space";
import { historySummary } from "@/lib/customer-space";
import { BookingCard, BookingRow } from "./booking-card";
import { SpaceTitle } from "./space-layout";

/** Maquette 8.5 : toutes les réservations, regroupées par atelier (pastille à sa couleur). */
export function AllBookingsPage({
  data,
}: {
  data: Awaited<ReturnType<typeof getAllCustomerBookings>>;
}) {
  const { account, groups, history, workspaceCount } = data;
  const [showHistory, setShowHistory] = useState(false);
  return (
    <section className="flex flex-col gap-9 rounded-3xl bg-surface px-5 pt-6 pb-8 sm:px-11 sm:pt-10 sm:pb-11">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <SpaceTitle displayFont={null}>Toutes mes réservations</SpaceTitle>
          <p className="text-base leading-6 text-ink-muted">
            {workspaceCount === 0
              ? `Aucune réservation avec ${account.email} pour l'instant.`
              : `Chez ${workspaceCount === 1 ? "l'atelier" : `les ${workspaceCount} ateliers`} où tu as réservé avec ${account.email}.`}
          </p>
        </div>
        <ButtonLink href="/mon-espace/profil" variant="soft" size="sm">
          Mon profil
        </ButtonLink>
      </div>

      {groups.map(({ workspace, upcoming }) => (
        <div key={workspace.slug} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: workspace.brandColor }}
              />
              <h2 className="text-lg font-semibold leading-6 text-ink">{workspace.name}</h2>
            </div>
            <ButtonLink href={`/${workspace.slug}/mon-espace`} variant="soft" size="xs" arrow>
              Mon espace chez {workspace.name}
            </ButtonLink>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((card) => (
              <BookingCard key={card.id} card={card} />
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-3 rounded-2xl bg-line-faint px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[15px] font-semibold leading-5 text-ink">
              Historique, tous ateliers confondus
            </h2>
            <p className="text-sm leading-5 text-ink-muted">
              {historySummary(history, "Europe/Paris")}
            </p>
          </div>
          {history.length > 0 && (
            <Button
              variant="inverse"
              size="xs"
              aria-expanded={showHistory}
              onClick={() => setShowHistory((value) => !value)}
            >
              {showHistory ? "Masquer" : "Voir l'historique"}
            </Button>
          )}
        </div>
        {showHistory && (
          <div className="flex flex-col rounded-2xl bg-surface px-4 py-1">
            {history.map((card) => (
              <BookingRow key={card.id} card={card} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

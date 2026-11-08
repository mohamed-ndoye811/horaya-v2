import { createFileRoute } from "@tanstack/react-router";
import { PassPurchaseForm } from "@/features/public/pass-purchase-form";
import { getPublicPassesPage } from "@/functions/passes";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";

/** Page publique « Acheter une carte » : formules de l'organisateur et coordonnées. */
export const Route = createFileRoute("/$slug/cartes/")({
  loader: ({ params }) => getPublicPassesPage({ data: params.slug }),
  head: () => ({ meta: [{ title: "Acheter une carte" }] }),
  component: PassesPublicPage,
});

function PassesPublicPage() {
  const { workspace, plans } = Route.useLoaderData();
  return (
    <section className="flex flex-col items-center rounded-3xl bg-surface px-6 py-10 sm:p-12">
      <div className="flex w-full max-w-[520px] flex-col gap-[22px]">
        <div className="flex flex-col gap-2">
          <h1
            className={cn(
              "text-[36px] leading-10 tracking-[-0.035em] text-ink sm:text-kpi sm:leading-[48px]",
              displayFontClass(workspace.displayFont),
            )}
          >
            Acheter une carte
          </h1>
          <p className="text-base leading-6 text-ink-muted">
            Chaque réservation utilise une séance de ta carte. Elle devient active quand{" "}
            {workspace.name} a reçu ton paiement.
          </p>
        </div>
        {plans.length === 0 ? (
          <p className="text-base text-ink-muted">Aucune carte n'est proposée pour l'instant.</p>
        ) : (
          <PassPurchaseForm slug={workspace.slug} plans={plans} />
        )}
      </div>
    </section>
  );
}

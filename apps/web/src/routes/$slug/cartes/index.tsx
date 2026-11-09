import { createFileRoute } from "@tanstack/react-router";
import { PassesShowcase } from "@/features/public/pass-purchase-form";
import { getPublicPassesPage } from "@/functions/passes";

/** Page publique « Les cartes de séances » : formules de l'organisateur et coordonnées. */
export const Route = createFileRoute("/$slug/cartes/")({
  loader: ({ params }) => getPublicPassesPage({ data: params.slug }),
  head: () => ({ meta: [{ title: "Cartes de séances" }] }),
  component: PassesPublicPage,
});

function PassesPublicPage() {
  const { workspace, plans } = Route.useLoaderData();
  if (plans.length === 0)
    return (
      <section className="flex flex-col items-center gap-2 rounded-3xl bg-surface px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-ink">Pas de carte en vente pour l'instant.</h1>
        <p className="text-base text-ink-muted">
          {workspace.name} n'en propose pas encore : tu peux réserver à la séance.
        </p>
      </section>
    );
  return <PassesShowcase workspace={workspace} plans={plans} />;
}

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ButtonLink } from "@/components/ui/button";
import { getPassThanksPage } from "@/functions/passes";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";

/** Après « Acheter une carte » : le lien de paiement de l'organisateur, s'il en a un. */
export const Route = createFileRoute("/$slug/cartes/merci")({
  validateSearch: z.object({ formule: z.string().max(60).optional().catch(undefined) }),
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) =>
    getPassThanksPage({ data: { slug: params.slug, formule: deps.formule } }),
  head: () => ({ meta: [{ title: "Carte demandée" }, { name: "robots", content: "noindex" }] }),
  component: PassThanksPage,
});

function PassThanksPage() {
  const { workspace, plan } = Route.useLoaderData();
  const link = workspace.paymentLinkUrl;
  return (
    <section className="flex flex-col items-center rounded-3xl bg-surface px-6 py-10 sm:p-12">
      <div className="flex w-full max-w-[520px] flex-col gap-[22px]">
        <h1
          className={cn(
            "text-[36px] leading-10 tracking-[-0.035em] text-ink sm:text-kpi sm:leading-[48px]",
            displayFontClass(workspace.displayFont),
          )}
        >
          Plus qu'à payer.
        </h1>
        <p className="text-base leading-6 text-ink-muted">
          {plan ? `Ta carte « ${plan.name} » est réservée. ` : "Ta demande est bien arrivée. "}
          {link
            ? `Règle-la via le lien de paiement de ${workspace.name} : dès que le paiement est reçu, la carte devient active et tu reçois un e-mail avec ton solde et sa date de fin.`
            : `${workspace.name} te précisera comment la régler. Dès que le paiement est reçu, la carte devient active et tu reçois un e-mail.`}
        </p>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          {link && (
            <ButtonLink href={link} variant="brand" size="lg" arrow>
              Payer ma carte
            </ButtonLink>
          )}
          <ButtonLink href={`/${workspace.slug}`} variant="secondary" size="lg">
            Voir les événements
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

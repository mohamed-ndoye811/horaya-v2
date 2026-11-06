import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { buttonClasses } from "@/components/ui/button";
import { getTestOnboarding } from "@/functions/payment-test";
import { Link } from "@/lib/navigation";
import { searchText } from "@/lib/search-params";

/** Remplace l'activation du compte Stripe Connect tant que les clés ne sont pas configurées. */
export const Route = createFileRoute("/paiement-test/compte")({
  validateSearch: z.object({ retour: searchText, compte: searchText }),
  loaderDeps: ({ search }) => ({ retour: search.retour }),
  loader: ({ deps }) => getTestOnboarding({ data: deps.retour }),
  head: () => ({
    meta: [{ title: "Activation de test" }, { name: "robots", content: "noindex" }],
  }),
  component: TestOnboardingPage,
});

function TestOnboardingPage() {
  const { back: safeBack } = Route.useLoaderData();
  const query = Route.useSearch();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-draft-bg px-4 py-12">
      <div className="flex w-full max-w-[440px] flex-col gap-6 border-2 border-ink bg-surface px-6 py-8">
        <p className="border-[1.5px] border-dashed border-warning bg-warning-bg px-4 py-3 text-sm font-semibold text-warning">
          Activation de test : avec les clés Stripe, c'est ici que Stripe demande l'identité, l'IBAN
          et les documents de l'organisateur.
        </p>
        <h1 className="font-headline text-[36px] leading-9 text-ink">Compte de paiement</h1>
        <p className="text-base font-medium text-ink-muted">
          Compte de test <span className="font-mono text-sm">{query.compte}</span> : il est activé
          tout de suite.
        </p>
        <Link href={safeBack} className={buttonClasses({ size: "lg" })}>
          Activer et revenir à Horaya
        </Link>
      </div>
    </main>
  );
}

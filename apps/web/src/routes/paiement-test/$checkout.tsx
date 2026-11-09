import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  getTestCheckout,
  leaveCheckoutAction,
  simulateExpiryAction,
  simulatePaymentAction,
} from "@/functions/payment-test";
import { formatMoney } from "@/lib/format";
import { searchText } from "@/lib/search-params";
import { useFormAction } from "@/lib/use-form-action";

/** Remplace la page de paiement Stripe tant que les clés ne sont pas configurées. */
export const Route = createFileRoute("/paiement-test/$checkout")({
  validateSearch: z.object({ ok: searchText, ko: searchText }),
  loader: ({ params }) => getTestCheckout({ data: params.checkout }),
  head: () => ({
    meta: [{ title: "Paiement de test" }, { name: "robots", content: "noindex" }],
  }),
  component: TestCheckoutPage,
});

function TestCheckoutPage() {
  const summary = Route.useLoaderData();
  const { checkout } = Route.useParams();
  const query = Route.useSearch();
  const ok = query.ok ?? "/";
  const ko = query.ko ?? "/";
  const done = summary.status !== "pending";
  // Chaque bouton appelle la passerelle de test, qui redirige (retour vers l'app).
  const pay = useFormAction<null>(() => simulatePaymentAction(checkout, ok), null);
  const leave = useFormAction<null>(() => leaveCheckoutAction(ko), null);
  const expire = useFormAction<null>(() => simulateExpiryAction(checkout, ko), null);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-draft-bg px-4 py-12">
      <div className="flex w-full max-w-[440px] flex-col gap-6">
        <p className="border-[1.5px] border-dashed border-warning bg-warning-bg px-4 py-3 text-sm font-semibold text-warning">
          Paiement de test : Stripe n'est pas encore branché, aucune carte n'est débitée.
        </p>
        <section className="flex flex-col border-2 border-ink bg-surface">
          <div
            className="flex flex-col gap-1 px-6 py-5 text-on-ink"
            style={{ backgroundColor: summary.brandColor }}
          >
            <p className="text-ui font-extrabold uppercase tracking-[0.02em]">
              {summary.organizationName}
            </p>
            <p className="text-sm font-medium opacity-90">
              {summary.title} · {summary.reference}
            </p>
          </div>
          <div className="flex flex-col gap-4 px-6 py-6">
            <p className="flex items-baseline justify-between">
              <span className="text-ui font-semibold text-ink-muted">
                {summary.kind === "deposit" ? "Acompte à payer" : "À payer"}
              </span>
              <span className="font-headline text-kpi leading-[44px] text-ink">
                {formatMoney(summary.amountCents)}
              </span>
            </p>
            <p className="text-sm font-medium text-ink-muted">
              Reçu envoyé à {summary.customerEmail}
            </p>
            {done ? (
              <p className="text-sm font-bold text-ink">
                Cette page de paiement est fermée (
                {summary.status === "succeeded" ? "payée" : "expirée"}).
              </p>
            ) : (
              <div className="flex flex-col gap-3 pt-2">
                <form onSubmit={pay.onSubmit}>
                  <Button type="submit" size="lg" className="w-full">
                    Payer {formatMoney(summary.amountCents)} (carte de test)
                  </Button>
                </form>
                <form onSubmit={leave.onSubmit}>
                  <Button type="submit" variant="secondary" className="w-full">
                    Revenir sans payer
                  </Button>
                </form>
                <form onSubmit={expire.onSubmit}>
                  <Button type="submit" variant="secondary" className="w-full">
                    Simuler l'expiration (30 min sans paiement)
                  </Button>
                </form>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

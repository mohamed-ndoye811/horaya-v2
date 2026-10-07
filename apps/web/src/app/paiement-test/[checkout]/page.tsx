import { getCheckoutSummary } from "@horaya/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { param } from "@/lib/search-params";
import { db } from "@/server/db";
import { testPayments } from "@/server/payments";
import { leaveCheckoutAction, simulateExpiryAction, simulatePaymentAction } from "../actions";

export const metadata: Metadata = { title: "Paiement de test", robots: { index: false } };

/** Remplace la page de paiement Stripe tant que les clés ne sont pas configurées. */
export default async function TestCheckoutPage({
  params,
  searchParams,
}: PageProps<"/paiement-test/[checkout]">) {
  if (!testPayments) notFound();
  const { checkout } = await params;
  const query = await searchParams;
  const summary = await getCheckoutSummary(db, "test", checkout);
  if (!summary) notFound();
  const ok = param(query.ok) ?? "/";
  const ko = param(query.ko) ?? "/";
  const done = summary.status !== "pending";

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
            <p className="text-[15px] font-extrabold uppercase tracking-[0.02em]">
              {summary.organizationName}
            </p>
            <p className="text-sm font-medium opacity-90">
              {summary.title} · {summary.reference}
            </p>
          </div>
          <div className="flex flex-col gap-4 px-6 py-6">
            <p className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold text-ink-muted">
                {summary.kind === "deposit" ? "Acompte à payer" : "À payer"}
              </span>
              <span className="font-headline text-[44px] leading-[44px] text-ink">
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
                <form action={simulatePaymentAction.bind(null, checkout, ok)}>
                  <Button type="submit" size="lg" className="w-full">
                    Payer {formatMoney(summary.amountCents)} (carte de test)
                  </Button>
                </form>
                <form action={leaveCheckoutAction.bind(null, ko)}>
                  <Button type="submit" variant="secondary" className="w-full">
                    Revenir sans payer
                  </Button>
                </form>
                <form action={simulateExpiryAction.bind(null, checkout, ko)}>
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

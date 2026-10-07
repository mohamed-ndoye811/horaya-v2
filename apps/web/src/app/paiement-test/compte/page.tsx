import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import { param } from "@/lib/search-params";
import { testPayments } from "@/server/payments";

export const metadata: Metadata = { title: "Activation de test", robots: { index: false } };

/** Remplace l'activation du compte Stripe Connect tant que les clés ne sont pas configurées. */
export default async function TestOnboardingPage({
  searchParams,
}: PageProps<"/paiement-test/compte">) {
  if (!testPayments) notFound();
  const query = await searchParams;
  const back = param(query.retour) ?? "/app/parametres/paiements";
  const target = new URL(back, process.env.BETTER_AUTH_URL);
  const safeBack =
    target.origin === new URL(process.env.BETTER_AUTH_URL ?? "http://localhost").origin
      ? target.toString()
      : "/app";
  return (
    <main className="flex min-h-dvh items-center justify-center bg-draft-bg px-4 py-12">
      <div className="flex w-full max-w-[440px] flex-col gap-6 border-2 border-ink bg-surface px-6 py-8">
        <p className="border-[1.5px] border-dashed border-warning bg-warning-bg px-4 py-3 text-sm font-semibold text-warning">
          Activation de test : avec les clés Stripe, c'est ici que Stripe demande l'identité, l'IBAN
          et les documents de l'organisateur.
        </p>
        <h1 className="font-headline text-[36px] leading-9 text-ink">Compte de paiement</h1>
        <p className="text-base font-medium text-ink-muted">
          Compte de test <span className="font-mono text-sm">{param(query.compte)}</span> : il est
          activé tout de suite.
        </p>
        <Link href={safeBack} className={buttonClasses({ size: "lg" })}>
          Activer et revenir à Horaya
        </Link>
      </div>
    </main>
  );
}

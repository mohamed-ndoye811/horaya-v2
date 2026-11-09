import { SettingsShell } from "@/components/app/settings-shell";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { inkCardClasses } from "@/components/ui/section";
import type { getPaymentsSettings } from "@/functions/settings";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { PaymentsForm } from "./payments-form";

const ACCOUNT_STATES: Record<
  string,
  { badge: string; tone: "success" | "warning" | "draft" | "danger"; line: string }
> = {
  not_connected: {
    badge: "Non connecté",
    tone: "draft",
    line: "Connecte ton compte pour encaisser les réservations par carte",
  },
  pending: {
    badge: "À finaliser",
    tone: "warning",
    line: "Activation à terminer chez Stripe (identité, IBAN)",
  },
  restricted: {
    badge: "À vérifier",
    tone: "danger",
    line: "Stripe demande des informations : paiements suspendus",
  },
  active: { badge: "Connecté", tone: "success", line: "Compte vérifié · versements automatiques" },
};

/** Écran 26 : connexion des paiements et réglages de facturation de l'espace. */
export function PaymentsSettingsPage({
  data,
  stripeError,
}: {
  data: Awaited<ReturnType<typeof getPaymentsSettings>>;
  stripeError: boolean;
}) {
  const { hasGateway, testPayments, collected, awaiting, month } = data;
  const connected = data.accountStatus === "active";
  const state = ACCOUNT_STATES[data.accountStatus] ?? ACCOUNT_STATES.not_connected;

  return (
    <SettingsShell
      section="paiements"
      breadcrumb="Paiements"
      subtitle={
        !hasGateway
          ? data.initial.paymentLinkUrl
            ? "Paiement en ligne par lien. Réception confirmée par l'équipe."
            : "Paiements sur place ou auprès de l'organisateur"
          : connected
            ? `Paiements en ligne via Stripe${testPayments ? " (mode test)" : ""} · versements automatiques`
            : "Paiements sur place tant que Stripe n'est pas connecté"
      }
      saveBar={{
        message: (
          <>
            <strong>Tes réglages de paiement</strong> s'appliquent aux nouvelles réservations.
          </>
        ),
        buttons: (
          <>
            <ButtonLink href="/app/parametres/paiements" variant="inverse-outline">
              Annuler
            </ButtonLink>
            <Button type="submit" form="payments-form" variant="inverse">
              Enregistrer
            </Button>
          </>
        ),
      }}
    >
      <div className="flex flex-col gap-4">
        {hasGateway ? (
          <section
            aria-label="Paiements en ligne"
            className="flex flex-col overflow-hidden rounded-3xl bg-surface"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-soft px-5 py-4">
              <div className="flex min-w-0 items-center gap-3.5">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#635BFF] text-xl font-bold text-white"
                >
                  S
                </span>
                <div className="flex min-w-0 flex-col gap-[3px]">
                  <p className="text-base font-extrabold text-ink">Stripe · {data.workspaceName}</p>
                  <p className="text-xs text-ink-subtle">
                    {data.accountLabel}
                    {state.line}
                  </p>
                </div>
                <StatusBadge tone={state.tone}>{state.badge}</StatusBadge>
              </div>
              {connected ? (
                testPayments ? (
                  <span className="text-xs font-bold text-warning">Mode test</span>
                ) : (
                  <a
                    href="https://dashboard.stripe.com/"
                    target="_blank"
                    rel="noreferrer"
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    Ouvrir Stripe ↗
                  </a>
                )
              ) : data.canConnect ? (
                // Envoi classique vers la route serveur, qui renvoie chez Stripe.
                <form method="post" action="/app/parametres/paiements/stripe">
                  <Button type="submit" size="sm">
                    {data.accountStatus === "not_connected"
                      ? "Connecter Stripe"
                      : "Reprendre l'activation"}
                  </Button>
                </form>
              ) : (
                <p className="text-meta font-medium text-ink-muted">
                  Le propriétaire de l'espace connecte Stripe.
                </p>
              )}
            </div>
            {stripeError && (
              <div className="border-b border-line-soft px-5 py-3">
                <FormAlert>Stripe n'a pas pu être joint. Réessaie dans un instant.</FormAlert>
              </div>
            )}
            <dl className="grid sm:grid-cols-3">
              {[
                ["Solde disponible", data.balance],
                ["Prochain virement", data.nextPayout],
                [`Encaissé en ${month}`, formatMoney(collected)],
              ].map(([label, value], index) => (
                <div
                  key={label}
                  className={`flex flex-col gap-2 px-5 py-4 ${index > 0 ? "border-t border-line-soft sm:border-t-0 sm:border-l" : ""}`}
                >
                  <dt className="text-xs font-semibold text-ink-subtle">{label}</dt>
                  <dd className="font-headline text-title-sm text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : (
          <section
            aria-label="Paiement par lien"
            className={cn(
              inkCardClasses,
              "flex flex-col gap-5 rounded-3xl p-5 lg:flex-row lg:items-stretch lg:p-6",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-on-ink"
                >
                  <svg
                    aria-hidden="true"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  >
                    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
                  </svg>
                </span>
                <h2 className="text-lg font-semibold leading-[22px] text-on-ink">
                  Paiement en ligne par lien
                </h2>
              </div>
              <p className="text-meta leading-5 text-on-ink-muted">
                Ton client reçoit un bouton « Payer » vers ton lien (Stripe, SumUp, PayPal,
                HelloAsso…). Quand l'argent arrive, ton équipe clique « Marquer comme payé » sur la
                réservation : les chiffres restent justes. Un événement peut avoir son propre lien.
              </p>
            </div>
            {/* Sur téléphone, les deux montants s'empilent : côte à côte, ils débordaient. */}
            <dl className="grid shrink-0 gap-3 sm:grid-cols-2 lg:w-[376px]">
              {[
                [`Encaissé en ${month}`, formatMoney(collected), "noté dans Horaya", "text-on-ink"],
                [
                  "À encaisser",
                  formatMoney(awaiting.cents),
                  `${awaiting.count} réservation${awaiting.count > 1 ? "s" : ""} à payer`,
                  "text-accent",
                ],
              ].map(([label, value, caption, tone]) => (
                <div
                  key={label}
                  className="flex min-w-0 flex-col gap-1.5 rounded-[18px] bg-white/[0.06] px-4 py-3.5"
                >
                  <dt className="text-xs font-semibold leading-4 text-on-ink-muted">{label}</dt>
                  <dd className={`font-headline text-subtitle tracking-[-0.03em] ${tone}`}>
                    {value}
                  </dd>
                  <dd className="text-xs leading-4 text-on-ink-muted">{caption}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <PaymentsForm
          editable={data.editable}
          initial={data.initial}
          showPaymentLink={!hasGateway}
        />
      </div>
    </SettingsShell>
  );
}

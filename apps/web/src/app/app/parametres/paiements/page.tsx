import { can, withDefaultPreferences } from "@horaya/core";
import { getNotificationPreferences, getWorkspaceSettings, sumCollectedSince } from "@horaya/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SettingsShell } from "@/components/app/settings-shell";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { startOfDay, todayIn } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { param } from "@/lib/search-params";
import { db } from "@/server/db";
import { paymentGateway, testPayments } from "@/server/payments";
import { getWorkspaceContext } from "@/server/workspace";
import { connectStripeAction } from "./actions";
import { PaymentsForm } from "./payments-form";

export const metadata: Metadata = { title: "Paiements & notifications · Horaya" };

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** Écran 26 : connexion des paiements, réglages de facturation et notifications du membre. */
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

export default async function PaymentsSettingsPage({
  searchParams,
}: PageProps<"/app/parametres/paiements">) {
  const { workspace, actor, timeZone } = await getWorkspaceContext();
  const stripeError = param((await searchParams).stripe) === "erreur";
  if (actor.type !== "member") notFound();
  const today = todayIn(timeZone);
  const [settings, saved, collected] = await Promise.all([
    getWorkspaceSettings(db, workspace.id),
    getNotificationPreferences(db, actor.memberId),
    sumCollectedSince(db, workspace.id, startOfDay({ ...today, day: 1 }, timeZone)),
  ]);
  if (!settings) notFound();
  const editable = can(actor.role, "settings", "update");
  const canConnect = can(actor.role, "billing", "manage");
  const connected = settings.stripeAccountStatus === "active";
  const state = ACCOUNT_STATES[settings.stripeAccountStatus] ?? ACCOUNT_STATES.not_connected;
  const accountId = settings.stripeAccountId;
  const balance =
    connected && accountId ? await paymentGateway.getBalance(accountId).catch(() => null) : null;
  const dayMonth = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone,
  });

  return (
    <SettingsShell
      section="paiements"
      breadcrumb="Paiements & notifications"
      subtitle={
        connected
          ? `Paiements en ligne via Stripe${testPayments ? " (mode test)" : ""} · versements automatiques`
          : "Paiements sur place tant que Stripe n'est pas connecté"
      }
      actions={
        <>
          <ButtonLink href="/app/parametres/paiements" variant="secondary">
            Annuler
          </ButtonLink>
          <Button type="submit" form="payments-form">
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-8">
        <section
          aria-label="Paiements en ligne"
          className="flex flex-col border-2 border-ink bg-surface"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-soft px-5 py-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center bg-[#635BFF] text-xl font-extrabold text-white"
              >
                S
              </span>
              <div className="flex min-w-0 flex-col gap-[3px]">
                <p className="text-base font-extrabold text-ink">Stripe · {workspace.name}</p>
                <p className="font-mono text-label text-ink-muted">
                  {accountId ? `${accountId.slice(0, 9)}…${accountId.slice(-4)} · ` : ""}
                  {state.line}
                </p>
              </div>
              <StatusBadge tone={state.tone}>{state.badge}</StatusBadge>
            </div>
            {connected ? (
              testPayments ? (
                <span className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-warning">
                  Mode test
                </span>
              ) : (
                <a
                  href="https://dashboard.stripe.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-10 items-center gap-2 border-2 border-ink px-4 text-sm font-bold text-ink transition-colors hover:bg-bg"
                >
                  Ouvrir Stripe ↗
                </a>
              )
            ) : canConnect ? (
              <form action={connectStripeAction}>
                <Button type="submit" className="h-10 px-4 text-sm">
                  {settings.stripeAccountStatus === "not_connected"
                    ? "Connecter Stripe"
                    : "Reprendre l'activation"}
                </Button>
              </form>
            ) : (
              <p className="text-[13px] font-medium text-ink-muted">
                Le propriétaire de l'espace connecte Stripe.
              </p>
            )}
          </div>
          {stripeError && (
            <p className="border-b border-line-soft bg-danger-bg px-5 py-3 text-sm font-semibold text-danger">
              Stripe n'a pas pu être joint. Réessaie dans un instant.
            </p>
          )}
          <dl className="grid sm:grid-cols-3">
            {[
              ["Solde disponible", balance ? formatMoney(balance.availableCents) : "—"],
              [
                "Prochain virement",
                balance?.nextPayoutAt
                  ? dayMonth.format(balance.nextPayoutAt).replace(/^./, (c) => c.toUpperCase())
                  : "—",
              ],
              [`Encaissé en ${MONTHS[today.month - 1]}`, formatMoney(collected)],
            ].map(([label, value], index) => (
              <div
                key={label}
                className={`flex flex-col gap-2 px-5 py-4 ${index > 0 ? "border-t border-line-soft sm:border-t-0 sm:border-l" : ""}`}
              >
                <dt className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-neutral">
                  {label}
                </dt>
                <dd className="font-headline text-[36px] leading-9 text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <PaymentsForm
          editable={editable}
          initial={{
            vatRate: String(settings.vatRateBps / 100).replace(".", ","),
            defaultDepositPercent: String(settings.defaultDepositPercent),
            freeCancellationHours: settings.freeCancellationHours,
            lateCancellationRefundPercent: settings.lateCancellationRefundPercent,
          }}
          preferences={withDefaultPreferences(saved)}
        />
      </div>
    </SettingsShell>
  );
}

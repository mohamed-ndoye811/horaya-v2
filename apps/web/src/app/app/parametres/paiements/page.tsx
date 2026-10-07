import { can, withDefaultPreferences } from "@horaya/core";
import {
  getNotificationPreferences,
  getWorkspaceSettings,
  sumConfirmedBookingsSince,
} from "@horaya/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SettingsShell } from "@/components/app/settings-shell";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { startOfDay, todayIn } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
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
export default async function PaymentsSettingsPage() {
  const { workspace, actor, timeZone } = await getWorkspaceContext();
  if (actor.type !== "member") notFound();
  const today = todayIn(timeZone);
  const [settings, saved, booked] = await Promise.all([
    getWorkspaceSettings(db, workspace.id),
    getNotificationPreferences(db, actor.memberId),
    sumConfirmedBookingsSince(db, workspace.id, startOfDay({ ...today, day: 1 }, timeZone)),
  ]);
  if (!settings) notFound();
  const editable = can(actor.role, "settings", "update");
  const connected = settings.stripeAccountStatus === "active";

  return (
    <SettingsShell
      section="paiements"
      breadcrumb="Paiements & notifications"
      subtitle={
        connected
          ? "Paiements en ligne via Stripe"
          : "Paiements sur place pour l'instant · paiement en ligne bientôt"
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
                  {connected ? "compte vérifié" : "non connecté · paiement en ligne bientôt"}
                </p>
              </div>
              <StatusBadge tone={connected ? "success" : "draft"}>
                {connected ? "Connecté" : "Bientôt"}
              </StatusBadge>
            </div>
            <Button variant="secondary" disabled className="h-10 px-4 text-sm">
              Connecter Stripe
            </Button>
          </div>
          <dl className="grid sm:grid-cols-3">
            {[
              ["Solde disponible", "—"],
              ["Prochain virement", "—"],
              [`Réservé en ${MONTHS[today.month - 1]}`, formatMoney(booked)],
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

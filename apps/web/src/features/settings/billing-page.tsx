import { type BillingInterval, PLAN_RANK, PLANS, type PlanId } from "@horaya/core";
import { useEffect, useRef, useState } from "react";
import { SettingsShell } from "@/components/app/settings-shell";
import { Swap } from "@/components/motion/swap";
import { StatusBadge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Check } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress";
import { SegmentedControl } from "@/components/ui/segmented";
import {
  billingPortal,
  checkoutPlan,
  type getBillingSettings,
  previewBilling,
} from "@/functions/billing";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { useRouter } from "@/lib/navigation";
import { PLAN_PREVIEWS, type PlanPreview } from "@/lib/plan-preview";
import { toast } from "@/lib/toast";

type Data = Awaited<ReturnType<typeof getBillingSettings>>;

/** Ce que chaque formule apporte, dans l'ordre où on le lit. */
const PERKS: Record<PlanId, string[]> = {
  libre: [
    "1 membre",
    "50 réservations par mois",
    "Événements et clients illimités",
    "Paiement par lien, abonnement d'agenda",
    "Page publique avec le logo Horaya",
  ],
  pro: [
    "3 membres",
    "1 000 réservations par mois",
    "Page publique sans logo Horaya",
    "Matériel et location",
    "Comptoir",
  ],
  equipe: [
    "Membres illimités",
    "Réservations illimitées",
    "Tout ce que propose Pro",
    "Les prochains ajouts en premier : domaine personnalisé, API, SSO",
  ],
};

/** Engagements affichés à tous : ce qu'Horaya s'interdit. */
const PROMISES = [
  "Aucune réservation de tes clients n'est jamais refusée à cause d'un quota.",
  "Tes données restent à toi : l'export est gratuit dans toutes les formules.",
  "Sans engagement : tu résilies en un clic, l'accès dure jusqu'à la fin de la période payée.",
  "Pas de commission sur tes réservations, pas de frais cachés.",
];

function sourceBadge(data: Data): { label: string; tone: Tone } {
  switch (data.source) {
    case "trial":
      return { label: `Essai gratuit jusqu'au ${data.until}`, tone: "info" };
    case "beta":
      return { label: "Formule bêta-testeur", tone: "success" };
    case "gift":
      return { label: data.until ? `Offerte jusqu'au ${data.until}` : "Offerte", tone: "success" };
    case "subscription":
      if (data.subscription?.status === "past_due")
        return { label: "Paiement en retard", tone: "warning" };
      if (data.subscription?.cancelAtPeriodEnd || data.subscription?.status === "canceled") {
        return { label: `Résiliée, active jusqu'au ${data.until}`, tone: "draft" };
      }
      return {
        label: data.subscription?.interval === "year" ? "Abonnement annuel" : "Abonnement mensuel",
        tone: "success",
      };
    default:
      return { label: "Gratuite", tone: "neutral" };
  }
}

/** Réglages > Abonnement : formule en cours, usage du mois, formules et engagements. */
export function BillingSettingsPage({ data, paid }: { data: Data; paid: boolean }) {
  const [interval, setInterval] = useState<BillingInterval>(data.subscription?.interval ?? "month");
  const [pending, setPending] = useState<string | null>(null);
  const current = PLANS[data.plan];
  const badge = sourceBadge(data);
  const subscribed = Boolean(data.subscription) && data.subscription?.status !== "canceled";
  const router = useRouter();
  const refresh = useRef(router.refresh);
  refresh.current = router.refresh;

  // Retour du paiement : le webhook de Polar arrive quelques secondes après. On recharge les
  // données toutes les 2 s jusqu'à voir l'abonnement, 30 s au plus.
  const waiting = paid && !subscribed;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => refresh.current(), 2000);
    const stop = window.setTimeout(() => window.clearInterval(timer), 30_000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [waiting]);

  // Messages du retour de paiement, une fois chacun : en attente, puis formule active.
  const announced = useRef<"none" | "waiting" | "active">("none");
  useEffect(() => {
    if (!paid || announced.current === "active") return;
    if (subscribed) {
      announced.current = "active";
      toast(`Merci ! Ta formule ${current.name} est active.`);
    } else if (announced.current === "none") {
      announced.current = "waiting";
      toast("Paiement validé : ta formule s'active dans quelques secondes.", { tone: "info" });
    }
  }, [paid, subscribed, current.name]);

  /** Paiement ou portail chez Polar : le navigateur part sur leur page. */
  async function go(key: string, request: () => Promise<string>) {
    setPending(key);
    try {
      window.location.assign(await request());
    } catch {
      toast("Le paiement n'a pas pu s'ouvrir. Réessaie dans un instant.", { tone: "error" });
      setPending(null);
    }
  }

  return (
    <SettingsShell
      section="abonnement"
      breadcrumb="Abonnement"
      subtitle={`Formule ${current.name} · ${badge.label.toLowerCase()}`}
    >
      <div className="flex flex-col gap-4">
        {data.preview && <PreviewSwitcher />}

        <section
          aria-label="Ta formule"
          className="flex flex-col overflow-hidden rounded-3xl bg-surface"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-soft px-5 py-4">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <p className="text-base font-extrabold text-ink">Formule {current.name}</p>
              <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
              {data.rate !== "standard" && (
                <StatusBadge tone="info">
                  {data.rate === "solidaire" ? "Tarif solidaire −50 %" : "Prix bêta-testeur bloqué"}
                </StatusBadge>
              )}
            </div>
            {subscribed && data.canManage && (
              <Button
                variant="secondary"
                size="sm"
                disabled={pending !== null}
                onClick={() => go("portal", () => billingPortal())}
              >
                Factures et résiliation
              </Button>
            )}
          </div>
          <dl className="grid sm:grid-cols-2">
            <Usage label="Membres et invitations" used={data.seats.used} limit={data.seats.limit} />
            <Usage
              label="Réservations ce mois-ci"
              used={data.bookings.thisMonth}
              limit={data.bookings.limit}
              className="border-t border-line-soft sm:border-t-0 sm:border-l"
            />
          </dl>
          {data.bookings.over && (
            <div className="border-t border-line-soft px-5 py-3">
              <FormAlert tone={data.bookings.suggestUpgrade ? "warning" : "info"}>
                {data.bookings.suggestUpgrade
                  ? "Deux mois de suite au-delà de ton quota : la formule supérieure te correspondrait mieux. Tes clients peuvent toujours réserver."
                  : "Tu as dépassé ton quota ce mois-ci. Rien ne change pour tes clients : leurs réservations passent toujours."}
              </FormAlert>
            </div>
          )}
        </section>

        <section aria-labelledby="formules" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="formules" className="font-section text-lg text-ink">
              Les formules
            </h2>
            <SegmentedControl
              name="interval"
              label="Période de paiement"
              size="xs"
              fill={false}
              value={interval}
              onChange={(value) => setInterval(value as BillingInterval)}
              segments={[
                { value: "month", label: "Mensuel" },
                { value: "year", label: "Annuel · 2 mois offerts" },
              ]}
            />
          </div>
          <ul className="grid gap-3 md:grid-cols-3">
            {(["libre", "pro", "equipe"] as const).map((id) => {
              const plan = PLANS[id];
              const isCurrent = id === data.plan;
              const price = plan.priceCents[interval];
              return (
                <li
                  key={id}
                  className={cn(
                    "flex flex-col gap-4 rounded-3xl p-5",
                    isCurrent ? "bg-ink text-on-ink" : "bg-surface text-ink",
                  )}
                >
                  <div className="flex flex-col gap-1">
                    <p className="font-section text-base">{plan.name}</p>
                    <p className="flex items-baseline gap-1">
                      <span className="font-headline text-subtitle">
                        <Swap value={String(price)}>
                          {price === 0 ? "0 €" : formatMoney(price)}
                        </Swap>
                      </span>
                      {price > 0 && (
                        <span
                          className={cn(
                            "text-sm",
                            isCurrent ? "text-on-ink-muted" : "text-ink-subtle",
                          )}
                        >
                          <Swap value={interval}>
                            {interval === "year" ? "par an" : "par mois"}
                          </Swap>
                        </span>
                      )}
                    </p>
                  </div>
                  <ul className="flex flex-1 flex-col gap-2 text-sm">
                    {PERKS[id].map((perk) => (
                      <li key={perk} className="flex gap-2">
                        <Check
                          className={cn(
                            "mt-0.5 shrink-0",
                            isCurrent ? "text-success-on-ink" : "text-success",
                          )}
                        />
                        {perk}
                      </li>
                    ))}
                  </ul>
                  <PlanAction
                    id={id}
                    data={data}
                    subscribed={subscribed}
                    isCurrent={isCurrent}
                    pending={pending}
                    onCheckout={() =>
                      go(id, () =>
                        checkoutPlan({ data: { plan: id as "pro" | "equipe", interval } }),
                      )
                    }
                    onPortal={() => go("portal", () => billingPortal())}
                  />
                </li>
              );
            })}
          </ul>
        </section>

        <section
          aria-labelledby="engagements"
          className="flex flex-col gap-3 rounded-3xl bg-surface p-5"
        >
          <h2 id="engagements" className="font-section text-base text-ink">
            Nos engagements
          </h2>
          <ul className="flex flex-col gap-2 text-sm text-ink-soft">
            {PROMISES.map((promise) => (
              <li key={promise} className="flex gap-2">
                <Check className="mt-0.5 shrink-0 text-success" />
                {promise}
              </li>
            ))}
          </ul>
          <p className="border-t border-line-faint pt-3 text-sm text-ink-muted">
            Association ou petite structure ? Le <strong>tarif solidaire</strong> divise le prix par
            deux :{" "}
            <a
              href="mailto:bonjour@horaya.app?subject=Tarif%20solidaire"
              className="font-semibold text-ink underline underline-offset-2"
            >
              écris-nous
            </a>
            .
          </p>
        </section>
      </div>
    </SettingsShell>
  );
}

function Usage({
  label,
  used,
  limit,
  className,
}: {
  label: string;
  used: number;
  limit: number | null;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 px-5 py-4", className)}>
      <dt className="text-xs font-semibold text-ink-subtle">{label}</dt>
      <dd className="flex flex-col gap-2">
        <span className="text-lg font-extrabold text-ink">
          {used}
          <span className="text-sm font-semibold text-ink-subtle">
            {limit === null ? " · illimité" : ` sur ${limit}`}
          </span>
        </span>
        {limit !== null && (
          <ProgressBar
            value={Math.min(used, limit)}
            max={limit}
            tone={used > limit ? "danger" : "ink"}
            label={`${used} sur ${limit}`}
          />
        )}
      </dd>
    </div>
  );
}

/** Bouton d'une formule : rien pour Libre, paiement pour monter, portail si déjà abonné. */
function PlanAction({
  id,
  data,
  subscribed,
  isCurrent,
  pending,
  onCheckout,
  onPortal,
}: {
  id: PlanId;
  data: Data;
  subscribed: boolean;
  isCurrent: boolean;
  pending: string | null;
  onCheckout: () => void;
  onPortal: () => void;
}) {
  const note = (text: string) => (
    <p className={cn("text-meta font-medium", isCurrent ? "text-on-ink-muted" : "text-ink-muted")}>
      {text}
    </p>
  );
  if (isCurrent && data.source === "subscription") return note("Ta formule actuelle");
  if (id === "libre") return note(isCurrent ? "Ta formule actuelle" : "Toujours gratuite");
  if (!data.canManage) return note("Le propriétaire de l'espace gère l'abonnement.");
  if (!data.available) return note("Le paiement en ligne arrive bientôt.");
  // Déjà abonné : changement de formule dans le portail Polar (prorata calculé par Polar).
  if (subscribed) {
    return (
      <Button variant="secondary" size="sm" disabled={pending !== null} onClick={onPortal}>
        Changer de formule
      </Button>
    );
  }
  const higher = PLAN_RANK[id] >= PLAN_RANK[data.plan];
  return (
    <Button
      variant={isCurrent ? "inverse" : "primary"}
      size="sm"
      disabled={pending !== null}
      onClick={onCheckout}
    >
      {pending === id
        ? "Ouverture…"
        : isCurrent
          ? data.source === "trial"
            ? `Garder ${PLANS[id].name} après l'essai`
            : `S'abonner à ${PLANS[id].name}`
          : higher
            ? `Passer à ${PLANS[id].name}`
            : `Choisir ${PLANS[id].name}`}
    </Button>
  );
}

/**
 * « Voir en tant que », sur les postes de développement : met l'espace dans une situation de
 * facturation (pour de vrai, dans la base locale) et recharge toute l'app.
 */
function PreviewSwitcher() {
  const router = useRouter();
  const [busy, setBusy] = useState<PlanPreview | null>(null);
  return (
    <section
      aria-label="Voir en tant que"
      className="flex flex-col gap-3 rounded-3xl border-[1.5px] border-dashed border-warning-line bg-warning-bg p-4"
    >
      <p className="text-meta font-semibold text-warning-strong">
        Voir en tant que · développement seulement
      </p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PLAN_PREVIEWS) as PlanPreview[]).map((choice) => (
          <Button
            key={choice}
            variant="soft"
            size="xs"
            disabled={busy !== null}
            onClick={async () => {
              setBusy(choice);
              await previewBilling({ data: choice });
              router.refresh();
              setBusy(null);
            }}
          >
            {busy === choice ? "…" : PLAN_PREVIEWS[choice]}
          </Button>
        ))}
      </div>
    </section>
  );
}

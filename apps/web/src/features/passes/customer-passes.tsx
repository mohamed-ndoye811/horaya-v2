import { useState } from "react";
import { Collapse, Disclosure } from "@/components/motion/collapse";
import { CountUp } from "@/components/motion/count-up";
import { PresenceItem, PresenceList } from "@/components/motion/presence";
import { StatusBadge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { cardClasses } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { getCustomer } from "@/functions/clients";
import { adjustPassAction, sellPassAction } from "@/functions/passes";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { Link } from "@/lib/navigation";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { METHOD_LABELS, PassPaymentActions } from "./pending-pass-row";

type Data = Awaited<ReturnType<typeof getCustomer>>;
type PassEntry = Data["passes"][number];

const KIND_LABELS = {
  purchase: "Achat",
  use: "Utilisation",
  recredit: "Recrédit",
  adjustment: "Ajustement",
} as const;

function stateOf(pass: PassEntry, now: Date): { label: string; tone: Tone } {
  if (pass.status === "pending") return { label: "À encaisser", tone: "warning" };
  if (pass.status === "cancelled") return { label: "Annulée", tone: "draft" };
  if (pass.expiresAt && pass.expiresAt <= now) return { label: "Expirée", tone: "draft" };
  if (pass.balance <= 0) return { label: "Terminée", tone: "draft" };
  return { label: "Active", tone: "success" };
}

/** Fiche client : cartes de séances, solde, journal des mouvements, vente et ajustement motivé. */
export function CustomerPasses({
  customerId,
  passes,
  plans,
  timeZone,
}: {
  customerId: string;
  passes: Data["passes"];
  plans: Data["sellablePlans"];
  timeZone: string;
}) {
  const now = new Date();
  const date = (value: Date) =>
    new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone })
      .format(value)
      .replace(".", "");
  return (
    <section className={cn(cardClasses, "relative gap-3")}>
      <h2 className="text-base font-semibold leading-5 text-ink">
        Cartes de séances
        <span className="ml-2 text-meta font-normal text-ink-subtle">{passes.length}</span>
      </h2>
      {passes.length === 0 && (
        <p className="text-meta leading-[17px] text-ink-subtle">Aucune carte pour l'instant.</p>
      )}
      <PresenceList>
        {passes.map((pass) => {
          const state = stateOf(pass, now);
          return (
            <PresenceItem
              as="article"
              key={pass.id}
              className="flex flex-col gap-2.5 rounded-[14px] bg-field p-3.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h3 className="truncate text-sm font-semibold text-ink">{pass.name}</h3>
                  <p className="text-xs text-ink-subtle">
                    {pass.expiresAt
                      ? `Valable jusqu'au ${date(pass.expiresAt)}`
                      : formatMoney(pass.priceCents)}
                  </p>
                </div>
                <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
              </div>
              {pass.status !== "pending" && pass.status !== "cancelled" && (
                <p className="text-sm text-ink">
                  <span className="text-2xl font-semibold tracking-tight">
                    <CountUp value={String(pass.balance)} />
                  </span>{" "}
                  séance
                  {pass.balance > 1 ? "s" : ""} restante{pass.balance > 1 ? "s" : ""} sur{" "}
                  {pass.sessionsTotal}
                </p>
              )}
              {pass.status === "pending" && <PassPaymentActions passId={pass.id} />}
              {pass.movements.length > 0 && (
                <Disclosure
                  summary={`Journal (${pass.movements.length})`}
                  summaryClassName="text-meta font-semibold text-ink-muted hover:text-ink"
                >
                  <ul className="mt-2 flex flex-col">
                    {pass.movements.map((movement) => (
                      <li
                        key={movement.id}
                        className="flex items-baseline justify-between gap-3 border-t border-line-soft py-1.5 text-meta"
                      >
                        <span className="min-w-0 text-ink-soft">
                          <span className="font-semibold text-ink">
                            {KIND_LABELS[movement.kind]}
                          </span>
                          {movement.bookingId && (
                            <>
                              {" · "}
                              <Link
                                href={`/app/reservations/${movement.bookingId}`}
                                className="underline underline-offset-2"
                              >
                                {movement.eventTitle ?? movement.bookingReference}
                              </Link>
                            </>
                          )}
                          {movement.reason && ` · ${movement.reason}`}
                          <span className="block text-xs text-ink-subtle">
                            {date(movement.createdAt)}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 font-semibold",
                            movement.delta > 0 ? "text-success" : "text-ink",
                          )}
                        >
                          {movement.delta > 0 ? "+" : "−"}
                          {Math.abs(movement.delta)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Disclosure>
              )}
              {pass.status === "active" && <AdjustForm passId={pass.id} />}
            </PresenceItem>
          );
        })}
      </PresenceList>
      {plans.length > 0 && <SellForm customerId={customerId} plans={plans} />}
    </section>
  );
}

function AdjustForm({ passId }: { passId: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    adjustPassAction.bind(null, passId),
    {},
  );
  return (
    <Disclosure
      summary="Ajuster le solde"
      summaryClassName="text-meta font-semibold text-ink-muted hover:text-ink"
    >
      <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-3">
        {state.error && !state.fieldErrors && <FormAlert>{state.error}</FormAlert>}
        {state.success && <FormAlert tone="success">{state.success}</FormAlert>}
        <div className="grid grid-cols-[90px_1fr] gap-3">
          <Field label="Séances" error={state.fieldErrors?.delta}>
            {(field) => (
              <input
                {...field}
                name="delta"
                type="number"
                step={1}
                required
                placeholder="+1"
                className={inputClasses("sm")}
              />
            )}
          </Field>
          <Field label="Motif" error={state.fieldErrors?.reason}>
            {(field) => (
              <input
                {...field}
                name="reason"
                required
                maxLength={300}
                placeholder="Geste commercial, erreur de saisie…"
                className={inputClasses("sm")}
              />
            )}
          </Field>
        </div>
        <Button
          type="submit"
          size="xs"
          variant="secondary"
          pending={pending}
          className="self-start"
        >
          Noter l'ajustement
        </Button>
      </form>
    </Disclosure>
  );
}

function SellForm({ customerId, plans }: { customerId: string; plans: Data["sellablePlans"] }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(sellPassAction, {});
  const [paid, setPaid] = useState(true);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 border-t border-line-faint pt-3">
      <input type="hidden" name="customerId" value={customerId} />
      <p className="text-meta font-semibold text-ink">Vendre une carte</p>
      {state.error && !state.fieldErrors && <FormAlert>{state.error}</FormAlert>}
      {state.success && <FormAlert tone="success">{state.success}</FormAlert>}
      <Select name="planId" aria-label="Formule" variant="compact" required defaultValue="">
        <option value="" disabled>
          Choisir une formule
        </option>
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name} · {formatMoney(plan.priceCents)}
          </option>
        ))}
      </Select>
      <Switch
        name="paid"
        checked={paid}
        onChange={(event) => setPaid(event.target.checked)}
        label="Déjà payée"
      />
      <Collapse open={paid}>
        <Select name="paymentMethod" aria-label="Moyen de paiement" variant="compact">
          <option value="">Moyen : non précisé</option>
          {Object.entries(METHOD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Collapse>
      <Button type="submit" size="xs" pending={pending} className="self-start">
        Vendre la carte
      </Button>
    </form>
  );
}

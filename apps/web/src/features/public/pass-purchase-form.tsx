import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { purchasePassAction } from "@/functions/passes";
import { cn } from "@/lib/cn";
import { formatMoney, plural } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

/** « Acheter une carte » : formule, coordonnées, puis page de paiement de l'organisateur. */
export function PassPurchaseForm({
  slug,
  plans,
}: {
  slug: string;
  plans: Array<{
    id: string;
    name: string;
    sessions: number;
    priceCents: number;
    validityDays: number;
  }>;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    purchasePassAction.bind(null, slug),
    {},
  );
  const errors = state.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="reveal-group auth-fields flex flex-col gap-[22px]">
      {state.error && !state.fieldErrors && <FormAlert>{state.error}</FormAlert>}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-meta font-semibold text-ink">Ta carte</legend>
        {plans.map((plan, index) => (
          <label
            key={plan.id}
            className={cn(
              "flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 press",
              "has-checked:border-ink has-checked:bg-band has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
            )}
          >
            <input
              type="radio"
              name="planId"
              value={plan.id}
              defaultChecked={index === 0}
              required
              className="sr-only"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-ui font-bold text-ink">{plan.name}</span>
              <span className="text-meta text-ink-muted">
                {plural(plan.sessions, "séance")} · valable {plan.validityDays} jours
              </span>
            </span>
            <span className="text-base font-extrabold text-ink">
              {formatMoney(plan.priceCents)}
            </span>
          </label>
        ))}
        {errors.planId && <p className="text-meta text-danger">{errors.planId}</p>}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" required error={errors.firstName}>
          {(field) => (
            <input
              {...field}
              name="firstName"
              required
              autoComplete="given-name"
              className={inputClasses("lg")}
            />
          )}
        </Field>
        <Field label="Nom" required error={errors.lastName}>
          {(field) => (
            <input
              {...field}
              name="lastName"
              required
              autoComplete="family-name"
              className={inputClasses("lg")}
            />
          )}
        </Field>
      </div>
      <Field label="Adresse e-mail" required error={errors.email}>
        {(field) => (
          <input
            {...field}
            type="email"
            name="email"
            required
            autoComplete="email"
            className={inputClasses("lg")}
          />
        )}
      </Field>
      <Field label="Téléphone" error={errors.phone}>
        {(field) => (
          <input
            {...field}
            type="tel"
            name="phone"
            autoComplete="tel"
            className={inputClasses("lg")}
          />
        )}
      </Field>
      <Button type="submit" variant="brand" size="lg" pending={pending} arrow>
        {pending ? "Un instant…" : "Acheter ma carte"}
      </Button>
    </form>
  );
}

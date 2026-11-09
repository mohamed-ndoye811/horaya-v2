import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSection } from "@/components/ui/section";
import { formatValidity } from "@/features/passes/validity";
import { purchasePassAction } from "@/functions/passes";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";
import { formatMoney, plural } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

interface Plan {
  id: string;
  name: string;
  sessions: number;
  priceCents: number;
  validityDays: number;
  /** Types d'événements acceptés ; vide : tous. */
  types: string[];
}

const perSession = (plan: Plan) => Math.round(plan.priceCents / plan.sessions);

/**
 * « Acheter une carte » (page publique) : les formules en grandes tuiles (prix de la séance, la
 * plus avantageuse signalée), les coordonnées, et à droite le récapitulatif avec le paiement et
 * le fonctionnement en trois étapes. Comme « Offrir un bon cadeau ».
 */
export function PassPurchaseForm({
  workspace,
  plans,
}: {
  workspace: { slug: string; name: string; displayFont: string };
  plans: Plan[];
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    purchasePassAction.bind(null, workspace.slug),
    {},
  );
  const errors = state.fieldErrors ?? {};
  const [selectedId, setSelectedId] = useState(plans[0]?.id);
  const selected = plans.find((plan) => plan.id === selectedId) ?? plans[0];
  // Formule la moins chère à la séance, signalée s'il y a le choix.
  const best =
    plans.length > 1
      ? plans.reduce((min, plan) => (perSession(plan) < perSession(min) ? plan : min))
      : undefined;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="reveal-group flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex flex-col gap-2 px-1 pt-2">
          <h1
            className={cn(
              "text-[36px] leading-10 tracking-[-0.035em] text-ink sm:text-kpi sm:leading-[48px]",
              displayFontClass(workspace.displayFont),
            )}
          >
            Les cartes de séances
          </h1>
          <p className="max-w-[560px] text-base leading-6 text-ink-muted">
            Tu viens souvent chez {workspace.name} ? Paie tes séances d'avance, moins cher, puis
            réserve en un clic sans repayer.
          </p>
        </header>
        {state.error && !state.fieldErrors && <FormAlert>{state.error}</FormAlert>}
        <FormSection number={1} title="Ta carte">
          <div
            role="radiogroup"
            aria-label="Ta carte"
            className={cn("grid gap-3", plans.length > 1 && "sm:grid-cols-2")}
          >
            {plans.map((plan) => (
              <label key={plan.id} className="flex cursor-pointer">
                <input
                  type="radio"
                  name="planId"
                  value={plan.id}
                  checked={plan.id === selected?.id}
                  onChange={() => setSelectedId(plan.id)}
                  required
                  className="peer sr-only"
                />
                {/* Choisie : remplie de la couleur de l'atelier (noir sans couleur). */}
                <span
                  className={cn(
                    "flex flex-1 flex-col gap-4 rounded-2xl border-[1.5px] border-line-soft bg-field p-5 text-ink press",
                    "peer-checked:border-[var(--brand)] peer-checked:bg-[var(--brand)] peer-checked:text-[var(--on-brand)]",
                    "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink",
                  )}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-base font-bold leading-5">{plan.name}</span>
                    {plan.id === best?.id && (
                      <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-xs font-bold leading-4 text-ink">
                        Le plus avantageux
                      </span>
                    )}
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "text-[40px] leading-[44px] tracking-[-0.03em]",
                        displayFontClass(workspace.displayFont),
                      )}
                    >
                      {formatMoney(plan.priceCents)}
                    </span>
                    <span className="text-sm font-semibold opacity-75">
                      {formatMoney(perSession(plan))} la séance
                    </span>
                  </span>
                  <span className="flex flex-col gap-1.5 border-t border-current/15 pt-3.5 text-sm leading-[18px]">
                    <span>✓ {plural(plan.sessions, "séance")}</span>
                    <span>✓ Valable {formatValidity(plan.validityDays)} après le paiement</span>
                    <span>
                      ✓ {plan.types.length === 0 ? "Pour tous les cours" : plan.types.join(", ")}
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </div>
          {errors.planId && <p className="text-[13px] text-danger">{errors.planId}</p>}
        </FormSection>
        <FormSection number={2} title="Toi">
          <div className="auth-fields grid gap-3 sm:grid-cols-2">
            <Field label="Prénom" required error={errors.firstName}>
              {(field) => (
                <input
                  {...field}
                  name="firstName"
                  required
                  autoComplete="given-name"
                  className={inputClasses()}
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
                  className={inputClasses()}
                />
              )}
            </Field>
            <Field label="Adresse e-mail" required error={errors.email}>
              {(field) => (
                <input
                  {...field}
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  className={inputClasses()}
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
                  className={inputClasses()}
                />
              )}
            </Field>
          </div>
        </FormSection>
      </div>
      <aside className="flex w-full shrink-0 flex-col gap-5 rounded-3xl bg-surface p-6 lg:sticky lg:top-[62px] lg:w-[360px]">
        {selected && (
          <div className="flex flex-col gap-1">
            <p className="text-[13px] font-semibold leading-4 text-ink-muted">Ta carte</p>
            <p className="text-lg font-semibold leading-6 text-ink">{selected.name}</p>
            <p
              className={cn(
                "text-[40px] leading-[44px] tracking-[-0.03em] text-ink",
                displayFontClass(workspace.displayFont),
              )}
            >
              {formatMoney(selected.priceCents)}
            </p>
            <p className="text-sm leading-5 text-ink-muted">
              {plural(selected.sessions, "séance")} à {formatMoney(perSession(selected))}, valable{" "}
              {formatValidity(selected.validityDays)}
            </p>
          </div>
        )}
        <Button type="submit" variant="brand" size="lg" pending={pending} arrow>
          {pending ? "Un instant…" : `Payer ${selected ? formatMoney(selected.priceCents) : ""}`}
        </Button>
        <ol className="flex flex-col gap-3 border-t border-line-faint pt-5">
          {[
            `Tu paies sur la page de paiement de ${workspace.name}.`,
            "Ta carte est active dès que le paiement est reçu.",
            "Tu réserves tes séances : chacune est décomptée de ta carte.",
          ].map((step, index) => (
            <li key={step} className="flex gap-3 text-sm leading-5 text-ink-muted">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold text-[var(--on-brand)]">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </aside>
    </form>
  );
}

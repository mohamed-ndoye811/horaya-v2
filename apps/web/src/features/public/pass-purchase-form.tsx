import { useId, useState } from "react";
import { Disclosure } from "@/components/motion/collapse";
import { PublicHero } from "@/components/public/public-events";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
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

interface Workspace {
  slug: string;
  name: string;
  displayFont: string;
  coverImageUrl?: string | null;
}

const perSession = (plan: Plan) => Math.round(plan.priceCents / plan.sessions);

/**
 * Vitrine des cartes de séances (page publique) : bandeau, formules en grille de tarifs (la
 * moins chère à la séance mise en avant), fonctionnement en trois étapes, questions fréquentes.
 * « Choisir cette carte » ouvre la fenêtre d'achat : coordonnées, puis paiement.
 */
export function PassesShowcase({ workspace, plans }: { workspace: Workspace; plans: Plan[] }) {
  const [chosen, setChosen] = useState<Plan | null>(null);
  const best =
    plans.length > 1
      ? plans.reduce((min, plan) => (perSession(plan) < perSession(min) ? plan : min))
      : undefined;
  const font = displayFontClass(workspace.displayFont);

  const steps = (
    <ol className="flex flex-col gap-5">
      {[
        ["Tu choisis ta carte", `et tu la paies sur la page de paiement de ${workspace.name}.`],
        ["Elle s'active", "dès que le paiement est reçu. Tu la retrouves dans ton espace."],
        ["Tu réserves", "en un clic, sans repayer : chaque séance est décomptée de ta carte."],
      ].map(([title, text], index) => (
        <li key={title} className="flex gap-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-bold text-[var(--on-brand)]">
            {index + 1}
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-base font-semibold leading-5 text-ink">{title}</span>
            <span className="text-sm leading-5 text-ink-muted">{text}</span>
          </span>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="flex flex-col gap-6">
      <PublicHero
        eyebrow={workspace.name}
        title="Cartes de séances"
        lead="Viens plus souvent, paie moins : tes séances réglées d'avance, à réserver en un clic."
        font={workspace.displayFont}
        cover={workspace.coverImageUrl}
      />
      <div className="reveal-group grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const highlight = plan.id === best?.id;
          return (
            <article
              key={plan.id}
              className={cn(
                "flex flex-col gap-6 rounded-3xl p-6 lg:p-7",
                highlight ? "bg-ink text-on-ink" : "bg-surface text-ink",
              )}
            >
              <header className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold leading-6">{plan.name}</h2>
                {highlight && (
                  <span className="shrink-0 rounded-full bg-[var(--brand)] px-3 py-1 text-xs font-bold leading-4 text-[var(--on-brand)]">
                    Le plus avantageux
                  </span>
                )}
              </header>
              <div className="flex flex-col gap-1">
                <p className={cn("text-[56px] leading-[56px] tracking-[-0.04em]", font)}>
                  {formatMoney(plan.priceCents)}
                </p>
                <p
                  className={cn(
                    "text-ui font-semibold",
                    highlight ? "text-[var(--brand-light)]" : "text-[var(--brand-text)]",
                  )}
                >
                  soit {formatMoney(perSession(plan))} la séance
                </p>
              </div>
              <ul
                className={cn(
                  "flex flex-1 flex-col gap-2.5 border-t pt-5 text-ui leading-5",
                  highlight ? "border-white/12" : "border-line-faint",
                )}
              >
                {[
                  plural(plan.sessions, "séance"),
                  `Valable ${formatValidity(plan.validityDays)} après le paiement`,
                  plan.types.length === 0
                    ? "Pour tous les cours"
                    : `Pour : ${plan.types.join(", ")}`,
                ].map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <span aria-hidden="true" className="font-bold text-[var(--brand)]">
                      ✓
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
              <Button variant="brand" size="lg" arrow onClick={() => setChosen(plan)}>
                Choisir cette carte
              </Button>
            </article>
          );
        })}
        {/* Peu de formules : le fonctionnement prend la place restante de la rangée. */}
        {plans.length < 3 && (
          <section
            className={cn(
              "flex flex-col gap-6 rounded-3xl bg-surface p-6 lg:p-7",
              plans.length === 1 && "lg:col-span-2",
            )}
          >
            <h2 className="text-lg font-semibold leading-6 text-ink">Comment ça marche</h2>
            {steps}
          </section>
        )}
      </div>
      {plans.length >= 3 && (
        <section className="flex flex-col gap-6 rounded-3xl bg-surface p-6 lg:p-7">
          <h2 className="text-lg font-semibold leading-6 text-ink">Comment ça marche</h2>
          {steps}
        </section>
      )}
      <section className="flex flex-col gap-2 rounded-3xl bg-surface p-6 lg:p-7">
        <h2 className="pb-2 text-lg font-semibold leading-6 text-ink">Questions fréquentes</h2>
        {[
          [
            "Combien de temps ma carte est-elle valable ?",
            "La durée est indiquée sur chaque carte. Elle compte à partir du moment où ton paiement est reçu.",
          ],
          [
            "Comment je l'utilise ?",
            "Réserve comme d'habitude : au moment de payer, choisis « Payer avec ma carte ». Une séance est décomptée, rien d'autre à régler.",
          ],
          [
            "Et si j'annule une réservation ?",
            `Si tu annules dans les délais de ${workspace.name}, la séance revient sur ta carte.`,
          ],
          [
            "Où je vois les séances qui me restent ?",
            "Dans ton espace (« Mon espace », en haut de la page), avec la date de fin de ta carte.",
          ],
        ].map(([question, answer]) => (
          <Disclosure
            key={question}
            className="border-t border-line-faint first-of-type:border-t-0"
            summaryClassName="flex w-full items-center justify-between gap-4 py-4 text-left text-ui font-semibold leading-5 text-ink"
            summary={(open) => (
              <>
                {question}
                <span aria-hidden="true" className="text-xl leading-none text-ink-subtle">
                  {open ? "−" : "+"}
                </span>
              </>
            )}
          >
            <p className="pb-4 text-ui leading-[22px] text-ink-muted">{answer}</p>
          </Disclosure>
        ))}
      </section>
      {chosen && (
        <CheckoutDialog workspace={workspace} plan={chosen} onClose={() => setChosen(null)} />
      )}
    </div>
  );
}

/** Fenêtre d'achat : la carte choisie, les coordonnées, puis la page de paiement de l'atelier. */
function CheckoutDialog({
  workspace,
  plan,
  onClose,
}: {
  workspace: Workspace;
  plan: Plan;
  onClose: () => void;
}) {
  const formId = useId();
  const { state, onSubmit, pending } = useFormAction<FormState>(
    purchasePassAction.bind(null, workspace.slug),
    {},
  );
  const errors = state.fieldErrors ?? {};
  return (
    <Dialog
      open
      onClose={onClose}
      title={plan.name}
      description={`${formatMoney(plan.priceCents)} · ${plural(plan.sessions, "séance")} à ${formatMoney(perSession(plan))} · valable ${formatValidity(plan.validityDays)}`}
      footer={
        <div className="flex w-full flex-col gap-2">
          <Button type="submit" form={formId} variant="brand" size="lg" pending={pending} arrow>
            {pending ? "Un instant…" : `Payer ${formatMoney(plan.priceCents)}`}
          </Button>
          <p className="text-center text-meta leading-[18px] text-ink-subtle">
            Paiement sur la page de {workspace.name}. Ta carte s'active dès réception.
          </p>
        </div>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="auth-fields flex flex-col gap-3">
        <input type="hidden" name="planId" value={plan.id} />
        {state.error && <FormAlert>{state.error}</FormAlert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Prénom" required error={errors.firstName}>
            {(field) => (
              <input
                {...field}
                name="firstName"
                required
                autoFocus
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
        </div>
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
      </form>
    </Dialog>
  );
}

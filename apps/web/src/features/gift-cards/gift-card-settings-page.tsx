import { SettingsShell } from "@/components/app/settings-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { AffixInput, Field, inputClasses, textareaClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSection } from "@/components/ui/section";
import { Switch } from "@/components/ui/switch";
import { type getGiftCardSettings, saveGiftCardSettingsAction } from "@/functions/gift-cards";
import { useSuccessToast } from "@/lib/toast";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

/** Paramètres › Bons cadeaux : activation, montants, validité, texte d'accompagnement. */
export function GiftCardSettingsPage({
  data,
}: {
  data: Awaited<ReturnType<typeof getGiftCardSettings>>;
}) {
  const { editable, initial, slug } = data;
  const { state, onSubmit } = useFormAction<FormState>(saveGiftCardSettingsAction, {});
  useSuccessToast(state);
  const errors = state.fieldErrors ?? {};
  return (
    <SettingsShell
      section="bons-cadeaux"
      breadcrumb="Bons cadeaux"
      subtitle="Vends des bons cadeaux sur ta page publique, sans commission."
      actions={
        <ButtonLink href="/app/bons-cadeaux" variant="secondary">
          Voir les bons
        </ButtonLink>
      }
      saveBar={{
        message: <strong>Ces réglages s'appliquent aux prochains bons vendus.</strong>,
        buttons: (
          <>
            <ButtonLink href="/app/parametres/bons-cadeaux" variant="inverse-outline">
              Annuler
            </ButtonLink>
            <Button type="submit" form="gift-card-settings-form" variant="inverse">
              Enregistrer
            </Button>
          </>
        ),
      }}
    >
      <form id="gift-card-settings-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        {state.error && <FormAlert>{state.error}</FormAlert>}
        <fieldset disabled={!editable} className="min-w-0">
          <FormSection number={1} title="Bons cadeaux">
            {!editable && (
              <p className="text-xs leading-4 text-ink-subtle">
                Seuls le propriétaire et les admins peuvent modifier ces réglages.
              </p>
            )}
            <Switch
              name="enabled"
              defaultChecked={initial.enabled}
              label="Proposer des bons cadeaux"
              description={`Un bouton « Offrir un bon cadeau » apparaît sur horaya.app/${slug}. Le paiement passe par ton lien de paiement : tu marques le bon payé, il devient actif.`}
            />
            <Field
              label="Montants proposés"
              error={errors.amounts}
              hint={
                <p className="text-meta font-medium text-ink-muted">
                  En euros, séparés par des virgules.
                </p>
              }
            >
              {(field) => (
                <input
                  {...field}
                  name="amounts"
                  defaultValue={initial.amounts}
                  placeholder="30, 50, 100"
                  className={inputClasses()}
                />
              )}
            </Field>
            <Switch
              name="customAmount"
              defaultChecked={initial.customAmount}
              label="Autoriser un montant libre"
              description="L'acheteur choisit son montant entre ces deux bornes."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Minimum" error={errors.minCents}>
                {(field) => (
                  <AffixInput
                    {...field}
                    name="min"
                    inputMode="decimal"
                    defaultValue={initial.min}
                    suffix="€"
                  />
                )}
              </Field>
              <Field label="Maximum" error={errors.maxCents}>
                {(field) => (
                  <AffixInput
                    {...field}
                    name="max"
                    inputMode="decimal"
                    defaultValue={initial.max}
                    suffix="€"
                  />
                )}
              </Field>
            </div>
          </FormSection>
          <div className="h-4" />
          <FormSection number={2} title="Validité et message">
            <Field label="Validité" error={errors.validityMonths}>
              {(field) => (
                <AffixInput
                  {...field}
                  name="validityMonths"
                  inputMode="numeric"
                  defaultValue={initial.validityMonths}
                  suffix="mois après le paiement"
                />
              )}
            </Field>
            <Field
              label="Texte d'accompagnement"
              error={errors.message}
              hint={
                <p className="text-meta font-medium text-ink-muted">
                  Affiché sur la page d'achat, sur le bon et dans son e-mail (conditions, ateliers
                  concernés…).
                </p>
              }
            >
              {(field) => (
                <textarea
                  {...field}
                  name="message"
                  rows={3}
                  maxLength={500}
                  defaultValue={initial.message}
                  className={textareaClasses()}
                />
              )}
            </Field>
          </FormSection>
        </fieldset>
      </form>
    </SettingsShell>
  );
}

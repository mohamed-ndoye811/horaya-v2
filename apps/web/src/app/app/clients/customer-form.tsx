"use client";

import { Button } from "@/components/ui/button";
import { Checkbox, Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSection } from "@/components/ui/section";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { saveCustomer } from "./actions";

export interface CustomerFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  tags: string;
  marketingConsent: boolean;
}

/** Ajout ou modification d'un client. */
export function CustomerForm({
  customerId,
  initial,
}: {
  customerId: string | null;
  initial: CustomerFormValues;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    saveCustomer.bind(null, customerId),
    {},
  );
  const errors = state.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="flex max-w-[768px] flex-col gap-10 px-4 py-8 sm:px-10">
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <FormSection number={1} title="Coordonnées">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" required error={errors.firstName}>
            {(field) => (
              <input
                {...field}
                name="firstName"
                required
                maxLength={60}
                defaultValue={initial.firstName}
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
                maxLength={60}
                defaultValue={initial.lastName}
                className={inputClasses()}
              />
            )}
          </Field>
          <Field label="E-mail" required error={errors.email}>
            {(field) => (
              <input
                {...field}
                type="email"
                name="email"
                required
                defaultValue={initial.email}
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
                maxLength={30}
                defaultValue={initial.phone}
                className={inputClasses()}
              />
            )}
          </Field>
          <Field label="Entreprise" error={errors.company}>
            {(field) => (
              <input
                {...field}
                name="company"
                maxLength={120}
                defaultValue={initial.company}
                className={inputClasses()}
              />
            )}
          </Field>
          <Field
            label="Étiquettes"
            error={errors.tags}
            hint={
              <p className="text-[13px] font-medium text-ink-muted">
                Séparées par des virgules. « vip » met le client en avant.
              </p>
            }
          >
            {(field) => (
              <input
                {...field}
                name="tags"
                defaultValue={initial.tags}
                placeholder="vip, traiteur…"
                className={inputClasses()}
              />
            )}
          </Field>
        </div>
        <Checkbox
          name="marketingConsent"
          defaultChecked={initial.marketingConsent}
          label="Accepte de recevoir les actualités de l'espace"
        />
      </FormSection>
      <div>
        <Button type="submit" pending={pending}>
          {customerId ? "Enregistrer" : "Ajouter le client"}
        </Button>
      </div>
    </form>
  );
}

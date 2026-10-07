"use client";

import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { requestBookingLinksAction } from "../actions";

export function RequestLinksForm({ slug, email }: { slug: string; email: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    requestBookingLinksAction.bind(null, slug),
    {},
  );
  if (state.success) {
    return (
      <div className="max-w-[560px]">
        <FormAlert tone="success">{state.success}</FormAlert>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex max-w-[560px] flex-col gap-5">
      {state.error && !state.fieldErrors && <FormAlert>{state.error}</FormAlert>}
      <Field label="Adresse e-mail" required error={state.fieldErrors?.form}>
        {(field) => (
          <input
            {...field}
            type="email"
            name="email"
            required
            autoComplete="email"
            defaultValue={email}
            placeholder="toi@exemple.fr"
            className={inputClasses("lg")}
          />
        )}
      </Field>
      <div>
        <Button type="submit" size="lg" arrow pending={pending}>
          Recevoir mes liens
        </Button>
      </div>
      <p className="text-[13px] font-medium text-ink-muted">
        Les nouveaux liens remplacent ceux reçus auparavant.
      </p>
    </form>
  );
}

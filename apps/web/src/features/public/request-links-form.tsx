import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { requestBookingLinksAction } from "@/functions/public";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

/** Maquette 5.5 : l'e-mail, puis la confirmation d'envoi sous le bouton. */
export function RequestLinksForm({ slug, email }: { slug: string; email: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    requestBookingLinksAction.bind(null, slug),
    {},
  );
  return (
    <form onSubmit={onSubmit} className="auth-fields flex flex-col gap-[22px]">
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
      <Button type="submit" variant="brand" size="lg" pending={pending} arrow>
        {pending ? "Un instant…" : "Recevoir mes liens"}
      </Button>
      {state.success && (
        <FormAlert
          tone="success"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
              <path
                d="m8 12 3 3 5-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        >
          <strong className="font-bold">C'est parti.</strong>{" "}
          <span className="font-normal">{state.success}</span>
        </FormAlert>
      )}
    </form>
  );
}

import { brandButtonClasses } from "@/components/public/public-chrome";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { ArrowRight } from "@/components/ui/icons";
import { requestBookingLinksAction } from "@/functions/public";
import { cn } from "@/lib/cn";
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
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={cn(brandButtonClasses, "h-[52px] text-base disabled:opacity-70")}
      >
        {pending ? "Un instant…" : "Recevoir mes liens"}
        {!pending && <ArrowRight />}
      </button>
      {state.success && (
        <p
          role="status"
          className="flex items-center gap-3 rounded-2xl bg-success-bg px-4 py-3.5 text-sm leading-5 text-success"
        >
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
          <span>
            <strong className="font-bold">C'est parti.</strong> {state.success}
          </span>
        </p>
      )}
    </form>
  );
}

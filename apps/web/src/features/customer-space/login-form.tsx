import { Button, ButtonLink } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { sendCustomerLoginLinkAction, signInCustomerAction } from "@/functions/customer-space";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

/**
 * Maquette 8.1 : l'e-mail, puis « Regarde tes e-mails » sous le bouton. `slug` null : vue
 * horaya.app.
 */
export function LoginForm({
  slug,
  email,
  minutes,
}: {
  slug: string | null;
  email: string;
  minutes: number;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    sendCustomerLoginLinkAction.bind(null, slug),
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
        {pending ? "Un instant…" : "Recevoir mon lien de connexion"}
      </Button>
      <p className="text-sm leading-5 text-ink-muted">
        Première visite ? Ton espace se crée tout seul avec l'adresse utilisée pour réserver. Tu
        peux toujours réserver sans espace.
      </p>
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
          <strong className="font-bold">Regarde tes e-mails.</strong>{" "}
          <span className="font-normal">
            Le lien envoyé à {state.success} te connecte pendant {minutes} minutes.
          </span>
        </FormAlert>
      )}
    </form>
  );
}

/**
 * Arrivée par le lien de l'e-mail : un bouton consomme le jeton (un antivirus de messagerie
 * qui ouvre le lien tout seul ne le grille pas).
 */
export function ConfirmLogin({ slug, token }: { slug: string | null; token: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    () => signInCustomerAction(slug, token),
    {},
  );
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-[22px]">
      {state.error && <FormAlert>{state.error}</FormAlert>}
      {state.error ? (
        <ButtonLink
          href={slug ? `/${slug}/mon-espace/connexion` : "/mon-espace/connexion"}
          variant="brand"
          size="lg"
          arrow
        >
          Recevoir un nouveau lien
        </ButtonLink>
      ) : (
        <Button type="submit" variant="brand" size="lg" pending={pending} arrow>
          {pending ? "Connexion…" : "Me connecter"}
        </Button>
      )}
    </form>
  );
}

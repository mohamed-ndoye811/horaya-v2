import type { CustomerAccount } from "@horaya/core";
import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { saveCustomerProfileAction } from "@/functions/customer-space";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { DeleteSpace, SignOutButton } from "./actions";
import { FormShell, SpaceAside, SpaceTitle } from "./space-layout";

/** Maquette 8.4 : nom, e-mail, téléphone (préremplissent les réservations), suppression RGPD. */
export function CustomerProfilePage({
  slug,
  workspaceName,
  displayFont,
  image,
  account,
}: {
  /** null : vue horaya.app. */
  slug: string | null;
  workspaceName: string | null;
  displayFont: string | null;
  image?: string | null;
  account: CustomerAccount;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    saveCustomerProfileAction.bind(null, slug),
    {},
  );
  const errors = state.fieldErrors ?? {};
  return (
    <FormShell
      aside={
        <SpaceAside eyebrow="Tes données" image={image}>
          Chaque atelier ne voit que tes réservations chez lui. Tu supprimes ton espace quand tu
          veux.
        </SpaceAside>
      }
    >
      <div className="flex flex-col gap-2">
        <SpaceTitle displayFont={displayFont}>Mon profil</SpaceTitle>
        <p className="text-base leading-6 text-ink-muted">
          {workspaceName
            ? `${workspaceName} s'en sert pour te prévenir si un cours change.`
            : "Les ateliers s'en servent pour te prévenir si un cours change."}{" "}
          Ces informations remplissent aussi tes prochaines réservations.
        </p>
      </div>
      <form onSubmit={onSubmit} className="auth-fields flex flex-col gap-[22px]">
        {state.error && <FormAlert>{state.error}</FormAlert>}
        {state.success && <FormAlert tone="success">{state.success}</FormAlert>}
        <div className="grid gap-[22px] sm:grid-cols-2 sm:gap-3">
          <Field label="Prénom" required error={errors.firstName}>
            {(field) => (
              <input
                {...field}
                name="firstName"
                required
                maxLength={60}
                autoComplete="given-name"
                defaultValue={account.firstName ?? ""}
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
                maxLength={60}
                autoComplete="family-name"
                defaultValue={account.lastName ?? ""}
                className={inputClasses("lg")}
              />
            )}
          </Field>
        </div>
        <Field
          label="Adresse e-mail"
          hint={
            <p className="text-meta leading-[18px] text-ink-muted">
              C'est elle qui te connecte. Pour une autre adresse, connecte-toi avec elle : elle aura
              son propre espace.
            </p>
          }
        >
          {(field) => (
            <input
              {...field}
              type="email"
              readOnly
              value={account.email}
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
              maxLength={30}
              autoComplete="tel"
              defaultValue={account.phone ?? ""}
              className={inputClasses("lg")}
            />
          )}
        </Field>
        <Button type="submit" variant="brand" size="lg" pending={pending}>
          {pending ? "Un instant…" : "Enregistrer"}
        </Button>
      </form>
      <div className="flex items-center justify-between gap-4 border-t border-line pt-[22px]">
        <div className="flex flex-col gap-0.5">
          <p className="text-ui font-semibold leading-5 text-ink">Supprimer mon espace</p>
          <p className="text-sm leading-5 text-ink-muted">
            Tes réservations à venir restent valables.
          </p>
        </div>
        <DeleteSpace slug={slug} />
      </div>
      <SignOutButton
        slug={slug}
        className="tap-area w-fit text-sm font-semibold leading-[18px] text-ink-muted underline underline-offset-2 hover:text-ink disabled:cursor-not-allowed"
      />
    </FormShell>
  );
}

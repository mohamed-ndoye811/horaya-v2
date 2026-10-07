"use client";

import { checkPassword } from "@horaya/core";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { AuthTitle, Eyebrow } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { PasswordMeter } from "@/components/auth/password-strength";
import { Button } from "@/components/ui/button";
import { OrDivider } from "@/components/ui/divider";
import { Checkbox, Field, inputClasses, PasswordInput } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import type { JoinTarget } from "@/server/invitation";

/** Écran 11 : création du compte (étape 1 sur 3). */
export function SignupForm({
  googleEnabled,
  invitation,
}: {
  googleEnabled: boolean;
  /** Arrivée depuis une invitation : pas de création d'espace, on rejoint celui qui invite. */
  invitation?: JoinTarget;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();

    const check = checkPassword(password);
    if (!check.acceptable) {
      const missing = check.rules.filter((rule) => rule.required && !rule.met);
      setPasswordError(
        `Il manque : ${missing.map((rule) => rule.label.toLowerCase()).join(", ")}.`,
      );
      return;
    }

    setPending(true);
    setError(null);
    setPasswordError(undefined);
    const { error } = await authClient.signUp.email({
      name: `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      email,
      password,
      callbackURL: invitation ? invitation.returnTo : "/app",
    });
    if (error) {
      setError(authErrorMessage(error));
      setPending(false);
      return;
    }
    router.push(invitation ? invitation.returnTo : "/inscription/espace");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-3">
        <Eyebrow>
          {invitation
            ? `Invitation · ${invitation.organizationName}`
            : "Étape 1 sur 3 · Ton compte"}
        </Eyebrow>
        <AuthTitle>Créer ton compte</AuthTitle>
      </div>

      {error && <FormAlert>{error}</FormAlert>}

      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <Field label="Prénom">
            {(field) => (
              <input
                {...field}
                name="firstName"
                autoComplete="given-name"
                required
                maxLength={60}
                className={inputClasses()}
              />
            )}
          </Field>
        </div>
        <div className="min-w-0 flex-1">
          <Field label="Nom">
            {(field) => (
              <input
                {...field}
                name="lastName"
                autoComplete="family-name"
                required
                maxLength={60}
                className={inputClasses()}
              />
            )}
          </Field>
        </div>
      </div>

      <Field label="E-mail professionnel">
        {(field) => (
          <input
            {...field}
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={invitation?.email ?? undefined}
            placeholder="toi@entreprise.fr"
            className={inputClasses()}
          />
        )}
      </Field>

      <Field
        label="Mot de passe"
        error={passwordError}
        hint={<PasswordMeter password={password} />}
      >
        {(field) => (
          <PasswordInput
            {...field}
            name="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError(undefined);
            }}
          />
        )}
      </Field>

      <Checkbox
        name="terms"
        required
        label={
          <span className="font-medium">
            J'accepte les conditions d'utilisation et la politique de confidentialité.
          </span>
        }
      />

      <Button size="lg" type="submit" arrow pending={pending} className="w-full">
        {pending ? "Création du compte…" : "Créer mon compte"}
      </Button>

      {googleEnabled && (
        <>
          <OrDivider />
          <GoogleButton label="S'inscrire avec Google" />
        </>
      )}
    </form>
  );
}

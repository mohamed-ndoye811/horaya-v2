"use client";

import { checkPassword } from "@horaya/core";
import Link from "next/link";
import { useActionState, useState } from "react";
import { AuthTitle, Eyebrow } from "@/components/auth/auth-shell";
import { PasswordChecklist, PasswordMeter } from "@/components/auth/password-strength";
import { Button, textLinkClasses } from "@/components/ui/button";
import { Field, PasswordInput } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Check, Envelope } from "@/components/ui/icons";
import { type ResetPasswordState, resetPassword } from "./actions";

export function ResetPasswordForm({ token, maskedEmail }: { token: string; maskedEmail: string }) {
  const [state, formAction, pending] = useActionState<ResetPasswordState, FormData>(
    resetPassword.bind(null, token),
    {},
  );
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const acceptable = checkPassword(password).acceptable;
  const matches = confirmation.length > 0 && confirmation === password;
  const mismatch = confirmation.length > 0 && !password.startsWith(confirmation);

  if (state.expired) {
    return (
      <div className="flex flex-col gap-5">
        <FormAlert>Ce lien n'est plus valable. Demande-en un nouveau.</FormAlert>
        <Link href="/mot-de-passe-oublie" className={textLinkClasses}>
          Recevoir un nouveau lien
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-[22px]">
      <FormAlert tone="success" icon={<Envelope size={20} className="shrink-0" />}>
        Lien vérifié pour {maskedEmail}
      </FormAlert>

      <div className="flex flex-col gap-3">
        <Eyebrow>Réinitialisation · Dernière étape</Eyebrow>
        <AuthTitle>Nouveau mot de passe</AuthTitle>
      </div>

      {state.error && <FormAlert>{state.error}</FormAlert>}

      <Field label="Nouveau mot de passe" hint={<PasswordMeter password={password} />}>
        {(field) => (
          <PasswordInput
            {...field}
            name="password"
            autoComplete="new-password"
            required
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
      </Field>

      <PasswordChecklist password={password} />

      <Field
        label="Confirmer le mot de passe"
        error={mismatch ? "Les deux mots de passe ne correspondent pas." : undefined}
        hint={
          matches ? (
            <p className="flex items-center gap-1.5 text-[13px] font-semibold leading-4 text-success">
              <Check />
              Les deux mots de passe correspondent.
            </p>
          ) : undefined
        }
      >
        {(field) => (
          <PasswordInput
            {...field}
            name="confirmation"
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            data-valid={matches}
          />
        )}
      </Field>

      <Button
        type="submit"
        arrow
        pending={pending}
        disabled={!acceptable || !matches}
        className="w-full"
      >
        {pending ? "Enregistrement…" : "Enregistrer et me connecter"}
      </Button>
    </form>
  );
}

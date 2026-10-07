"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { AuthLead, AuthTitle, Eyebrow } from "@/components/auth/auth-shell";
import { Button, textLinkClasses } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { ArrowLeft, Envelope } from "@/components/ui/icons";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

const RESEND_DELAY_SECONDS = 45;

/** « m•••••@diamondy.dev » : on confirme l'adresse sans l'afficher en entier. */
function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}•••••@${domain}`;
}

/** Écrans 13 et 13b : demande du lien, puis confirmation d'envoi. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendLink() {
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/nouveau-mot-de-passe",
    });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    setSent(true);
    setCooldown(RESEND_DELAY_SECONDS);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendLink();
  }

  const back = (
    <Link
      href="/connexion"
      className={`${textLinkClasses} flex items-center gap-2 text-sm no-underline`}
    >
      <ArrowLeft />
      Retour à la connexion
    </Link>
  );

  if (sent) {
    const minutes = Math.floor(cooldown / 60);
    const seconds = String(cooldown % 60).padStart(2, "0");
    return (
      <div className="flex flex-col gap-7">
        {back}
        <div className="flex flex-col gap-3">
          <Eyebrow>E-mail envoyé</Eyebrow>
          <AuthTitle>Vérifie ta boîte</AuthTitle>
          <AuthLead>
            Clique sur le lien reçu pour choisir un nouveau mot de passe. Tu peux fermer cette page.
          </AuthLead>
        </div>
        <div
          className="flex items-center gap-4 border-2 border-success bg-success-bg p-[18px]"
          role="status"
        >
          <span className="flex size-12 shrink-0 items-center justify-center bg-success text-white">
            <Envelope />
          </span>
          <div className="flex min-w-0 flex-col gap-1 text-success">
            <p className="text-base font-bold leading-5">Lien envoyé à {maskEmail(email)}</p>
            <p className="text-sm font-medium leading-[19px]">
              Valable 30 minutes. Pense à vérifier tes spams.
            </p>
          </div>
        </div>
        {error && <FormAlert>{error}</FormAlert>}
        <Button
          type="button"
          variant="secondary"
          onClick={() => void sendLink()}
          disabled={cooldown > 0}
          pending={pending}
          className="w-full"
        >
          {cooldown > 0 ? `Renvoyer le lien dans ${minutes}:${seconds}` : "Renvoyer le lien"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-7">
      {back}
      <div className="flex flex-col gap-3">
        <Eyebrow>Réinitialisation</Eyebrow>
        <AuthTitle>Mot de passe oublié</AuthTitle>
        <AuthLead>
          Indique l'e-mail de ton compte : on t'envoie un lien pour choisir un nouveau mot de passe.
          Il reste valable 30 minutes.
        </AuthLead>
      </div>
      {error && <FormAlert>{error}</FormAlert>}
      <Field label="Adresse e-mail">
        {(field) => (
          <input
            {...field}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value.trim())}
            className={inputClasses("lg")}
          />
        )}
      </Field>
      <Button type="submit" arrow pending={pending} className="w-full">
        {pending ? "Envoi…" : "Recevoir le lien"}
      </Button>
    </form>
  );
}

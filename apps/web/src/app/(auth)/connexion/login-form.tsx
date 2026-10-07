"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { AuthTitle, Eyebrow } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { Button, textLinkClasses } from "@/components/ui/button";
import { OrDivider } from "@/components/ui/divider";
import { Checkbox, Field, inputClasses, PasswordInput } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

/** Écrans 01 et 02 : e-mail, puis mot de passe. */
export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStep("password");
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email,
      password: String(form.get("password") ?? ""),
      rememberMe: form.get("remember") === "on",
    });
    if (error) {
      setError(authErrorMessage(error));
      setPending(false);
      return;
    }
    router.replace("/app");
    router.refresh();
  }

  if (step === "email") {
    return (
      <form onSubmit={submitEmail} className="flex flex-col gap-7">
        <div className="flex flex-col gap-3">
          <Eyebrow>Étape 1 sur 2</Eyebrow>
          <AuthTitle>Connexion</AuthTitle>
        </div>
        <Field label="Adresse e-mail">
          {(field) => (
            <input
              {...field}
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value.trim())}
              placeholder="toi@entreprise.fr"
              className={inputClasses("lg")}
            />
          )}
        </Field>
        <Button size="lg" type="submit" arrow className="w-full">
          Continuer
        </Button>
        {googleEnabled && (
          <>
            <OrDivider />
            <GoogleButton label="Continuer avec Google" />
          </>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={submitPassword} className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <Eyebrow>Étape 2 sur 2</Eyebrow>
        <AuthTitle>Mot de passe</AuthTitle>
      </div>

      <div className="flex items-center justify-between gap-3 border-[1.5px] border-ink-subtle bg-surface px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center bg-cat-meetup text-label font-bold uppercase text-on-ink"
          >
            {email.slice(0, 1)}
          </span>
          <span className="truncate text-[15px] font-semibold leading-5 text-ink">{email}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setError(null);
          }}
          className={`${textLinkClasses} shrink-0 text-sm`}
        >
          Modifier
        </button>
      </div>

      {/* Aide les gestionnaires de mots de passe à associer l'identifiant. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />

      {error && <FormAlert>{error}</FormAlert>}

      <Field label="Mot de passe">
        {(field) => (
          <PasswordInput
            {...field}
            name="password"
            autoComplete="current-password"
            required
            autoFocus
            inputSize="lg"
          />
        )}
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Checkbox name="remember" defaultChecked label="Rester connecté" />
        <Link href="/mot-de-passe-oublie" className={`${textLinkClasses} text-sm`}>
          Mot de passe oublié ?
        </Link>
      </div>

      <Button size="lg" type="submit" arrow pending={pending} className="w-full">
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}

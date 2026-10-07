"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { GoogleLogo } from "@/components/ui/icons";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

/** Connexion / inscription Google. Les nouveaux comptes passent par la création d'espace. */
export function GoogleButton({ label }: { label: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/app",
      newUserCallbackURL: "/inscription/espace",
      errorCallbackURL: "/connexion",
    });
    // En cas de succès, le navigateur part chez Google : on ne revient ici qu'en cas d'erreur.
    if (error) {
      setError(authErrorMessage(error));
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
        className={buttonClasses({ variant: "secondary", size: "lg", className: "w-full" })}
      >
        <GoogleLogo />
        {pending ? "Redirection vers Google…" : label}
      </button>
      {error && <p className="text-[13px] font-semibold text-danger">{error}</p>}
    </div>
  );
}

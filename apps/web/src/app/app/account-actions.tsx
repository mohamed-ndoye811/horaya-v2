"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.replace("/connexion");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="shrink-0 border-2 border-on-ink px-4 py-2 text-sm font-bold text-on-ink transition-colors hover:bg-on-ink hover:text-ink disabled:opacity-60"
    >
      {pending ? "Déconnexion…" : "Se déconnecter"}
    </button>
  );
}

/** Rappel tant que l'adresse e-mail n'est pas confirmée. */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [status, setStatus] = useState<"idle" | "pending" | "sent" | string>("idle");

  async function resend() {
    setStatus("pending");
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/app" });
    setStatus(error ? authErrorMessage(error) : "sent");
  }

  return (
    <div
      role="status"
      className="flex max-w-3xl flex-wrap items-center justify-between gap-3 border-[1.5px] border-warning bg-warning-bg px-4 py-3 text-sm font-semibold text-warning"
    >
      <p>
        Confirme ton adresse e-mail : on t'a envoyé un lien à <strong>{email}</strong>.
      </p>
      {status === "sent" ? (
        <span className="font-bold">Nouveau lien envoyé.</span>
      ) : (
        <button
          type="button"
          onClick={resend}
          disabled={status === "pending"}
          className="font-bold underline decoration-1 underline-offset-[3px] disabled:opacity-60"
        >
          {status === "pending" ? "Envoi…" : "Renvoyer le lien"}
        </button>
      )}
      {status !== "idle" && status !== "pending" && status !== "sent" && (
        <p className="w-full text-danger">{status}</p>
      )}
    </div>
  );
}

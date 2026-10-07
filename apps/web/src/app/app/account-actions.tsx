"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

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

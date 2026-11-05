"use client";

import { useState } from "react";
import { Banner } from "@/components/ui/banner";
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
    <div className="-mx-4 flex flex-col gap-2">
      <Banner
        action={
          status === "sent" ? (
            <span>Nouveau lien envoyé</span>
          ) : (
            <button type="button" onClick={resend} disabled={status === "pending"}>
              {status === "pending" ? "Envoi…" : "Renvoyer le lien"}
            </button>
          )
        }
      >
        <strong>Confirme ton adresse e-mail :</strong> on t'a envoyé un lien à {email}.
      </Banner>
      {status !== "idle" && status !== "pending" && status !== "sent" && (
        <p className="px-4 text-[13px] font-semibold text-danger">{status}</p>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { brandButtonClasses } from "@/components/public/public-chrome";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormAlert } from "@/components/ui/form-alert";
import { cn } from "@/lib/cn";
import {
  cancelManagedBookingAction,
  payManagedBookingAction,
  resendBookingEmailAction,
} from "../../actions";

/** « Rien reçu ? … renvoie l'e-mail. » (sur le bandeau sombre de la maquette 5.4). */
export function ResendEmail({ slug, token }: { slug: string; token: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <p>
      Rien reçu ? Vérifie tes spams ou{" "}
      {message ? (
        <span className="font-semibold text-white">{message}</span>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await resendBookingEmailAction(slug, token);
              setMessage(result.success ?? result.error ?? null);
            })
          }
          className="font-semibold text-white underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          renvoie l'e-mail
        </button>
      )}
      .
    </p>
  );
}

const REFUND_TONES = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  draft: "bg-draft-bg text-draft",
};

/** Annulation par le client (maquette 5.6) : ce qui est remboursé, puis la confirmation. */
export function CancelBooking({
  slug,
  token,
  description,
  refund,
  policy,
}: {
  slug: string;
  token: string;
  description: string;
  /** Montant remboursé si quelque chose a été payé. */
  refund: { label: string; amount: string; tone: keyof typeof REFUND_TONES; text: string } | null;
  /** Politique d'annulation quand rien n'a été payé. */
  policy: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 text-sm font-bold leading-[18px] text-danger hover:underline"
      >
        Annuler
      </button>
      {open && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title="Annuler ta réservation ?"
          description={policy ? `${description} ${policy}` : description}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)} className="flex-1">
                Garder ma réservation
              </Button>
              <Button
                variant="danger-solid"
                className="flex-1"
                pending={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await cancelManagedBookingAction(slug, token);
                    if (result.error) {
                      setError(result.error);
                      return;
                    }
                    setOpen(false);
                    router.refresh();
                  })
                }
              >
                Annuler la réservation
              </Button>
            </>
          }
        >
          {refund || error ? (
            <>
              {refund && (
                <div
                  className={cn("flex flex-col gap-2.5 rounded-2xl p-4", REFUND_TONES[refund.tone])}
                >
                  <p className="flex justify-between gap-4 text-sm font-bold leading-[18px]">
                    <span>{refund.label}</span>
                    <span>{refund.amount}</span>
                  </p>
                  <p className="text-[13px] leading-[19px]">{refund.text}</p>
                </div>
              )}
              {error && <FormAlert>{error}</FormAlert>}
            </>
          ) : null}
        </Dialog>
      )}
    </>
  );
}

/** Reprend le paiement en ligne (page de paiement sécurisée). */
export function PayButton({ slug, token, label }: { slug: string; token: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      {error && <FormAlert>{error}</FormAlert>}
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        className={cn(brandButtonClasses, "h-[54px] px-[26px] text-base disabled:opacity-70")}
        onClick={() =>
          startTransition(async () => {
            const result = await payManagedBookingAction(slug, token);
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? "Un instant…" : label}
      </button>
    </>
  );
}

/** Retour de Stripe : on relit la page le temps que le webhook confirme le paiement. */
export function PaymentPending() {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (tries >= 15) return;
    const timer = setTimeout(() => {
      setTries((count) => count + 1);
      router.refresh();
    }, 2000);
    return () => clearTimeout(timer);
  }, [tries, router]);
  return (
    <p role="status" className="text-sm font-semibold text-white/75">
      {tries >= 15
        ? "Le paiement met du temps à se confirmer : tu recevras un e-mail dès que c'est fait."
        : "Confirmation du paiement…"}
    </p>
  );
}

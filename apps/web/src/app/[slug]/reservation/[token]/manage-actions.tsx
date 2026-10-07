"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormAlert } from "@/components/ui/form-alert";
import {
  cancelManagedBookingAction,
  payManagedBookingAction,
  resendBookingEmailAction,
} from "../../actions";

/** « Rien reçu ? … renvoie l'e-mail. » */
export function ResendEmail({ slug, token }: { slug: string; token: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <p className="text-sm font-medium leading-5 text-ink-muted">
      Rien reçu ? Vérifie tes spams ou{" "}
      {message ? (
        <span className="font-bold text-success">{message}</span>
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
          className="font-bold text-ink underline decoration-1 underline-offset-[3px] disabled:cursor-not-allowed disabled:opacity-60"
        >
          renvoie l'e-mail
        </button>
      )}
      .
    </p>
  );
}

/** Annulation par le client, avec la politique d'annulation rappelée. */
export function CancelBooking({
  slug,
  token,
  policy,
}: {
  slug: string;
  token: string;
  policy: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)} className="w-full">
        Annuler ma réservation
      </Button>
      {open && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title="Annuler ta réservation ?"
          description={policy ?? "Tes places seront libérées pour d'autres participants."}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Garder ma réservation
              </Button>
              <Button
                variant="danger"
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
                Oui, annuler
              </Button>
            </>
          }
        >
          {error && <FormAlert>{error}</FormAlert>}
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
      <Button
        size="lg"
        arrow
        pending={pending}
        className="w-full"
        onClick={() =>
          startTransition(async () => {
            const result = await payManagedBookingAction(slug, token);
            if (result?.error) setError(result.error);
          })
        }
      >
        {label}
      </Button>
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
    <p role="status" className="text-sm font-semibold text-ink-muted">
      {tries >= 15
        ? "Le paiement met du temps à se confirmer : tu recevras un e-mail dès que c'est fait."
        : "Confirmation du paiement…"}
    </p>
  );
}

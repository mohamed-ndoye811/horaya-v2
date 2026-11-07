import { isRedirect, useRouter as useTanstackRouter } from "@tanstack/react-router";
import { useEffect, useState, useTransition } from "react";
import { StatusBadge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormAlert } from "@/components/ui/form-alert";
import { resendBookingEmailAction } from "@/functions/public";
import { useRouter } from "@/lib/navigation";
import type { FormState } from "@/server/form-state";

/** « Rien reçu ? … renvoie l'e-mail. » (sur le bandeau sombre de la maquette 5.4). */
export function ResendEmail({ slug, token }: { slug: string; token: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <p>
      Rien reçu ? Vérifie tes spams ou{" "}
      {message ? (
        <span className="font-semibold text-on-ink">{message}</span>
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
          className="tap-area font-semibold text-on-ink underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          renvoie l'e-mail
        </button>
      )}
      .
    </p>
  );
}

/** Annulation par le client (maquette 5.6) : ce qui est remboursé, puis la confirmation. */
export function CancelBooking({
  cancel,
  description,
  refund,
  policy,
  trigger = "Annuler",
  asButton = false,
}: {
  /** Action serveur d'annulation (lien « Gérer ma réservation » ou espace client). */
  cancel: () => Promise<FormState>;
  description: string;
  /** Montant remboursé si quelque chose a été payé. */
  refund: { label: string; amount: string; tone: Tone; text: string } | null;
  /** Politique d'annulation quand rien n'a été payé. */
  policy: string | null;
  /** Libellé du lien qui ouvre la confirmation. */
  trigger?: string;
  /** Vrai bouton secondaire de ton danger plutôt que lien texte (espace client). */
  asButton?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      {asButton ? (
        <Button variant="danger" onClick={() => setOpen(true)}>
          {trigger}
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap-area shrink-0 text-sm font-bold leading-[18px] text-danger underline-offset-2 hover:underline"
        >
          {trigger}
        </button>
      )}
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
                    const result = await cancel();
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
                <div className="flex flex-col gap-2.5 rounded-2xl bg-field p-4">
                  <p className="flex items-center justify-between gap-4 text-sm font-bold leading-[18px] text-ink">
                    <StatusBadge tone={refund.tone}>{refund.label}</StatusBadge>
                    <span>{refund.amount}</span>
                  </p>
                  <p className="text-[13px] leading-[19px] text-ink-muted">{refund.text}</p>
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
export function PayButton({
  pay,
  label,
  size = "xl",
}: {
  /** Action serveur qui redirige vers la page de paiement. */
  pay: () => Promise<FormState | undefined>;
  label: string;
  size?: "sm" | "lg" | "xl";
}) {
  const router = useTanstackRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      {error && <FormAlert>{error}</FormAlert>}
      <Button
        variant="brand"
        size={size}
        pending={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              const result = await pay();
              if (result?.error) setError(result.error);
            } catch (thrown) {
              // Page de paiement : le serveur répond par une redirection (Stripe, autre origine).
              if (!isRedirect(thrown)) throw thrown;
              await router.navigate(thrown.options);
            }
          })
        }
      >
        {pending ? "Un instant…" : label}
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
    <p role="status" className="text-sm font-semibold text-on-ink/75">
      {tries >= 15
        ? "Le paiement met du temps à se confirmer : tu recevras un e-mail dès que c'est fait."
        : "Confirmation du paiement…"}
    </p>
  );
}

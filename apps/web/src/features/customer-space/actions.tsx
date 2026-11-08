import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import {
  deleteCustomerSpaceAction,
  payCustomerBookingAction,
  signOutCustomerAction,
} from "@/functions/customer-space";
import { formatMoney } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { PayButton } from "../public/manage-actions";

/**
 * « Payer 85 € » : le lien de paiement de l'atelier (nouvel onglet), ou la page de paiement
 * sécurisée (Stripe), comme « Gérer ma réservation ».
 */
export function PayAction({
  slug,
  bookingId,
  pay,
  size = "sm",
}: {
  slug: string;
  bookingId: string;
  pay: { due: number; url: string | null };
  size?: "sm" | "lg";
}) {
  const label = `Payer ${formatMoney(pay.due)}`;
  if (pay.url) {
    return (
      <a
        href={pay.url}
        target="_blank"
        rel="noreferrer"
        className={buttonClasses({ variant: "brand", size })}
      >
        {label} ↗
      </a>
    );
  }
  return (
    <PayButton pay={() => payCustomerBookingAction(slug, bookingId)} label={label} size={size} />
  );
}

/** « Mes cours dans mon agenda » : abonnement au flux personnel (Google, Apple, Outlook). */
export function FeedButton({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const webcal = url.replace(/^https?:/, "webcal:");
  return (
    <>
      <Button variant="soft" size="xs" onClick={() => setOpen(true)}>
        Ajouter
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Mes cours dans mon agenda"
        description="Tes réservations apparaissent dans ton agenda et se mettent à jour toutes seules. Cette adresse est personnelle : ne la partage pas."
        footer={
          <>
            <a
              href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({ variant: "secondary" })}
            >
              Google Agenda
            </a>
            <a href={webcal} className={buttonClasses({ variant: "secondary" })}>
              Apple Calendrier ou Outlook
            </a>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {copied && <FormAlert tone="success">{copied}</FormAlert>}
          <div className="flex gap-2">
            <input
              readOnly
              aria-label="Adresse de ton agenda"
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              className={inputClasses()}
            />
            <Button
              className="shrink-0"
              onClick={() =>
                navigator.clipboard
                  .writeText(url)
                  .then(() => setCopied("Adresse copiée."))
                  .catch(() => setCopied("Sélectionne l'adresse pour la copier."))
              }
            >
              Copier
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

/** Se déconnecter de l'espace client (la session organisateur, s'il y en a une, ne bouge pas). */
export function SignOutButton({ slug, className }: { slug: string | null; className: string }) {
  const { onSubmit, pending } = useFormAction<FormState>(() => signOutCustomerAction(slug), {});
  return (
    <form onSubmit={onSubmit} className="contents">
      <button type="submit" disabled={pending} className={className}>
        Se déconnecter
      </button>
    </form>
  );
}

/** RGPD (maquette 8.4) : l'espace client disparaît, les réservations restent chez l'atelier. */
export function DeleteSpace({ slug }: { slug: string | null }) {
  const [open, setOpen] = useState(false);
  const { onSubmit, pending } = useFormAction<FormState>(() => deleteCustomerSpaceAction(slug), {});
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap-area shrink-0 text-sm font-semibold leading-[18px] text-danger underline underline-offset-2"
      >
        Supprimer
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Supprimer ton espace ?"
        description="Ton profil et ton agenda personnel sont effacés, et tu es déconnecté·e. Tes réservations restent valables chez chaque atelier, qui garde ses propres fiches. Tu pourras recréer un espace avec un nouveau lien."
        footer={
          <form className="flex w-full gap-2" onSubmit={onSubmit}>
            <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
              Garder mon espace
            </Button>
            <Button type="submit" variant="danger-solid" className="flex-1" pending={pending}>
              Supprimer mon espace
            </Button>
          </form>
        }
      />
    </>
  );
}

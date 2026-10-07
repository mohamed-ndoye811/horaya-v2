"use client";

import type { BookingStatus } from "@horaya/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  cancelBookingAction,
  confirmBookingAction,
  refundBookingAction,
  refuseBookingAction,
} from "@/app/app/reservations/actions";
import { Button, IconButton } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/chip";
import { Dialog } from "@/components/ui/dialog";
import { AffixInput, Field, textareaClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Check, CloseIcon } from "@/components/ui/icons";
import { ActionMenu } from "@/components/ui/menu";

const REFUSAL_REASONS = [
  "Événement complet",
  "Profil non adapté",
  "Date ou horaire impossible",
  "Autre",
];
const CANCEL_REASONS = ["Demande du client", "Empêchement de l'équipe", "Doublon", "Autre"];

type Result = { error?: string; success?: string };

/** Exécute une action serveur, affiche le résultat quelques secondes et rafraîchit la page. */
function useBookingAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const run = (action: () => Promise<Result>, onSuccess?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setMessage({ tone: "danger", text: result.error });
        return;
      }
      setMessage(result.success ? { tone: "success", text: result.success } : null);
      onSuccess?.();
      router.refresh();
      setTimeout(() => setMessage(null), 4000);
    });
  return { pending, message, run };
}

function Toast({ message }: { message: { tone: "success" | "danger"; text: string } | null }) {
  if (!message) return null;
  return (
    <div className="fixed right-6 bottom-6 z-50 max-w-sm" role="status">
      <FormAlert tone={message.tone}>{message.text}</FormAlert>
    </div>
  );
}

/** Fenêtre « motif » partagée par le refus et l'annulation. */
function ReasonDialog({
  open,
  onClose,
  title,
  description,
  reasons,
  confirmLabel,
  pending,
  error,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  reasons: string[];
  confirmLabel: string;
  pending: boolean;
  error?: string;
  onConfirm: (reason: string) => void;
}) {
  const [choice, setChoice] = useState<string | null>(reasons[0] ?? null);
  const [details, setDetails] = useState("");
  const reason = [choice === "Autre" ? null : choice, details.trim() || null]
    .filter(Boolean)
    .join(" — ");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Retour
          </Button>
          <Button
            variant="danger"
            pending={pending}
            disabled={choice === "Autre" && !details.trim()}
            onClick={() => onConfirm(reason)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ChoiceChips
          label="Motif"
          name="reason"
          options={reasons}
          value={choice}
          onChange={setChoice}
        />
        <textarea
          aria-label="Précisions"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={3}
          placeholder={choice === "Autre" ? "Indique le motif…" : "Ajouter un mot (facultatif)…"}
          className={textareaClasses()}
        />
        {error && <FormAlert>{error}</FormAlert>}
      </div>
    </Dialog>
  );
}

/**
 * Actions d'une ligne de réservation : valider / refuser d'un clic pour une demande en
 * attente (écran 05), sinon menu « … ».
 */
export function BookingRowActions({
  bookingId,
  customerName,
  status,
}: {
  bookingId: string;
  customerName: string;
  status: BookingStatus;
}) {
  const { pending, message, run } = useBookingAction();
  const [dialog, setDialog] = useState<"refuse" | "cancel" | null>(null);
  const active = status === "pending" || status === "confirmed" || status === "waitlisted";

  return (
    <>
      {status === "pending" ? (
        <div className="flex gap-2">
          <IconButton
            label={`Valider la réservation de ${customerName}`}
            variant="approve"
            disabled={pending}
            onClick={() => run(() => confirmBookingAction(bookingId))}
          >
            <Check size={14} />
          </IconButton>
          <IconButton
            label={`Refuser la réservation de ${customerName}`}
            variant="refuse"
            onClick={() => setDialog("refuse")}
          >
            <CloseIcon size={12} />
          </IconButton>
        </div>
      ) : (
        <ActionMenu
          label={`Actions pour ${customerName}`}
          items={[
            { label: "Voir la réservation", href: `/app/reservations/${bookingId}` },
            ...(status === "waitlisted"
              ? [
                  {
                    label: "Refuser la demande",
                    tone: "danger" as const,
                    onSelect: () => setDialog("refuse"),
                  },
                ]
              : []),
            ...(active
              ? [
                  {
                    label: "Annuler la réservation",
                    tone: "danger" as const,
                    onSelect: () => setDialog("cancel"),
                  },
                ]
              : []),
          ]}
        />
      )}
      {dialog === "refuse" && (
        <ReasonDialog
          open
          onClose={() => setDialog(null)}
          title="Refuser la demande ?"
          description={`${customerName} ne sera plus inscrit·e ; les places libérées profitent à la liste d'attente.`}
          reasons={REFUSAL_REASONS}
          confirmLabel="Refuser"
          pending={pending}
          error={message?.tone === "danger" ? message.text : undefined}
          onConfirm={(reason) =>
            run(
              () => refuseBookingAction(bookingId, reason),
              () => setDialog(null),
            )
          }
        />
      )}
      {dialog === "cancel" && (
        <ReasonDialog
          open
          onClose={() => setDialog(null)}
          title="Annuler la réservation ?"
          description={`La réservation de ${customerName} sera annulée ; les places libérées profitent à la liste d'attente.`}
          reasons={CANCEL_REASONS}
          confirmLabel="Annuler la réservation"
          pending={pending}
          error={message?.tone === "danger" ? message.text : undefined}
          onConfirm={(reason) =>
            run(
              () => cancelBookingAction(bookingId, reason),
              () => setDialog(null),
            )
          }
        />
      )}
      {!dialog && <Toast message={message} />}
    </>
  );
}

/** Boutons de l'en-tête de la fiche réservation (écran 17). */
export function BookingHeaderActions({
  bookingId,
  customerName,
  status,
}: {
  bookingId: string;
  customerName: string;
  status: BookingStatus;
}) {
  const { pending, message, run } = useBookingAction();
  const [dialog, setDialog] = useState<"refuse" | "cancel" | null>(null);

  return (
    <>
      {(status === "pending" || status === "waitlisted") && (
        <Button variant="danger" icon={<CloseIcon size={12} />} onClick={() => setDialog("refuse")}>
          Refuser
        </Button>
      )}
      {status === "pending" && (
        <Button
          variant="success"
          icon={<Check />}
          pending={pending}
          onClick={() => run(() => confirmBookingAction(bookingId))}
        >
          Valider la réservation
        </Button>
      )}
      {status === "confirmed" && (
        <Button variant="danger" onClick={() => setDialog("cancel")}>
          Annuler la réservation
        </Button>
      )}
      {dialog === "refuse" && (
        <ReasonDialog
          open
          onClose={() => setDialog(null)}
          title="Refuser la demande ?"
          description={`${customerName} verra le motif choisi quand les e-mails aux participants seront branchés.`}
          reasons={REFUSAL_REASONS}
          confirmLabel="Refuser"
          pending={pending}
          error={message?.tone === "danger" ? message.text : undefined}
          onConfirm={(reason) =>
            run(
              () => refuseBookingAction(bookingId, reason),
              () => setDialog(null),
            )
          }
        />
      )}
      {dialog === "cancel" && (
        <ReasonDialog
          open
          onClose={() => setDialog(null)}
          title="Annuler la réservation ?"
          description="Les places libérées profitent aussitôt à la liste d'attente."
          reasons={CANCEL_REASONS}
          confirmLabel="Annuler la réservation"
          pending={pending}
          error={message?.tone === "danger" ? message.text : undefined}
          onConfirm={(reason) =>
            run(
              () => cancelBookingAction(bookingId, reason),
              () => setDialog(null),
            )
          }
        />
      )}
      {!dialog && <Toast message={message} />}
    </>
  );
}

/** Remboursement (tout ou partie) d'une réservation payée en ligne. */
export function RefundButton({ bookingId, maxCents }: { bookingId: string; maxCents: number }) {
  const { pending, message, run } = useBookingAction();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState((maxCents / 100).toFixed(2).replace(".", ","));
  const max = (maxCents / 100).toFixed(2).replace(".", ",");
  return (
    <>
      <Button variant="secondary" className="h-10 px-4 text-sm" onClick={() => setOpen(true)}>
        Rembourser
      </Button>
      {open && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title="Rembourser"
          description={`Jusqu'à ${max} € : le client est remboursé sur sa carte (5 à 10 jours selon sa banque) et reçoit un e-mail.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Retour
              </Button>
              <Button
                variant="danger"
                pending={pending}
                onClick={() =>
                  run(
                    () => refundBookingAction(bookingId, amount),
                    () => setOpen(false),
                  )
                }
              >
                Rembourser {amount} €
              </Button>
            </>
          }
        >
          <Field label="Montant">
            {(field) => (
              <AffixInput
                {...field}
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                suffix="€"
                mono
              />
            )}
          </Field>
        </Dialog>
      )}
      <Toast message={message} />
    </>
  );
}

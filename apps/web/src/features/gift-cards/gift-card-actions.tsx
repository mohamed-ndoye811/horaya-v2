import { type ReactNode, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AffixInput, Field, textareaClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import {
  adjustGiftCardAction,
  cancelGiftCardAction,
  markGiftCardPaidAction,
} from "@/functions/gift-cards";
import { useRouter } from "@/lib/navigation";

type Result = { error?: string; success?: string };

/** Lance une action serveur, affiche l'erreur éventuelle et recharge la fiche. */
function useGiftCardAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => Promise<Result>, onSuccess: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      onSuccess();
      router.refresh();
    });
  return { pending, error, run };
}

function ActionDialog({
  title,
  description,
  confirm,
  tone = "primary",
  pending,
  error,
  disabled,
  onClose,
  onConfirm,
  children,
}: {
  title: string;
  description: string;
  confirm: string;
  tone?: "primary" | "danger";
  pending: boolean;
  error: string | null;
  disabled?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Retour
          </Button>
          <Button variant={tone} pending={pending} disabled={disabled} onClick={onConfirm}>
            {confirm}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {children}
        {error && <FormAlert>{error}</FormAlert>}
      </div>
    </Dialog>
  );
}

/** Boutons de la fiche d'un bon : marquer payé, ajuster le solde, annuler. */
export function GiftCardActions({
  id,
  state,
}: {
  id: string;
  state: "pending" | "active" | "used" | "expired" | "cancelled";
}) {
  const { pending, error, run } = useGiftCardAction();
  const [dialog, setDialog] = useState<"paid" | "adjust" | "cancel" | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const close = () => setDialog(null);
  const canAdjust = state === "active" || state === "used" || state === "expired";

  return (
    <>
      {state === "pending" && <Button onClick={() => setDialog("paid")}>Marquer comme payé</Button>}
      {canAdjust && (
        <Button variant="secondary" onClick={() => setDialog("adjust")}>
          Ajuster le solde
        </Button>
      )}
      {state !== "cancelled" && (
        <Button variant="danger" onClick={() => setDialog("cancel")}>
          Annuler le bon
        </Button>
      )}
      {dialog === "paid" && (
        <ActionDialog
          title="Paiement reçu ?"
          description="Le bon devient actif et son e-mail part à l'acheteur (et au bénéficiaire s'il est renseigné)."
          confirm="Marquer comme payé"
          pending={pending}
          error={error}
          onClose={close}
          onConfirm={() => run(() => markGiftCardPaidAction(id), close)}
        />
      )}
      {dialog === "adjust" && (
        <ActionDialog
          title="Ajuster le solde"
          description="Un montant positif ajoute au solde, un montant négatif en retire (« -10 »). La raison reste dans le journal."
          confirm="Ajuster"
          pending={pending}
          error={error}
          disabled={!amount.trim() || !note.trim()}
          onClose={close}
          onConfirm={() =>
            run(
              () => adjustGiftCardAction(id, amount, note),
              () => {
                close();
                setAmount("");
                setNote("");
              },
            )
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
          <Field label="Raison">
            {(field) => (
              <textarea
                {...field}
                rows={2}
                maxLength={300}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className={textareaClasses()}
              />
            )}
          </Field>
        </ActionDialog>
      )}
      {dialog === "cancel" && (
        <ActionDialog
          title="Annuler ce bon ?"
          description="Le solde restant est retiré et le code ne fonctionne plus. Rembourser l'acheteur se fait de ton côté."
          confirm="Annuler le bon"
          tone="danger"
          pending={pending}
          error={error}
          disabled={!note.trim()}
          onClose={close}
          onConfirm={() => run(() => cancelGiftCardAction(id, note), close)}
        >
          <Field label="Raison">
            {(field) => (
              <textarea
                {...field}
                rows={2}
                maxLength={300}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className={textareaClasses()}
              />
            )}
          </Field>
        </ActionDialog>
      )}
    </>
  );
}

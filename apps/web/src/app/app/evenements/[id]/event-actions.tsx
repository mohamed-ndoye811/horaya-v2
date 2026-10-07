"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { textareaClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { ActionMenu } from "@/components/ui/menu";
import { cancelEventAction, publishEventAction } from "../actions";

/** Menu « … » de la fiche : publier un brouillon, annuler l'événement (avec confirmation). */
export function EventActions({
  eventId,
  status,
  activeBookings,
}: {
  eventId: string;
  status: "draft" | "published" | "cancelled";
  activeBookings: number;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (status === "cancelled") return null;

  const run = (action: () => Promise<{ error?: string; success?: string }>, after?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (result.error) setMessage({ tone: "danger", text: result.error });
      else {
        setMessage(result.success ? { tone: "success", text: result.success } : null);
        after?.();
        router.refresh();
      }
    });

  return (
    <>
      <ActionMenu
        label="Plus d'actions"
        items={[
          ...(status === "draft"
            ? [
                {
                  label: "Publier l'événement",
                  onSelect: () => run(() => publishEventAction(eventId)),
                },
              ]
            : []),
          {
            label: "Annuler l'événement",
            tone: "danger" as const,
            onSelect: () => setConfirmOpen(true),
          },
        ]}
      />
      {message && !confirmOpen && (
        <div className="fixed right-6 bottom-6 z-50 max-w-sm" role="status">
          <FormAlert tone={message.tone}>{message.text}</FormAlert>
        </div>
      )}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Annuler l'événement ?"
        description={
          activeBookings > 0
            ? `Les ${activeBookings} réservation${activeBookings > 1 ? "s" : ""} en cours ser${activeBookings > 1 ? "ont" : "a"} annulée${activeBookings > 1 ? "s" : ""}. C'est définitif.`
            : "L'événement disparaîtra de ta page publique. C'est définitif."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Garder l'événement
            </Button>
            <Button
              variant="danger"
              pending={pending}
              onClick={() =>
                run(
                  () => cancelEventAction(eventId, reason),
                  () => setConfirmOpen(false),
                )
              }
            >
              Annuler l'événement
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-2 text-sm font-bold text-ink">
          Motif (facultatif, gardé dans l'historique)
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Intervenant malade, salle indisponible…"
            className={textareaClasses()}
          />
        </label>
        {message?.tone === "danger" && (
          <div className="mt-4">
            <FormAlert>{message.text}</FormAlert>
          </div>
        )}
      </Dialog>
    </>
  );
}

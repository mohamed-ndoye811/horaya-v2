import type { PaymentMethod } from "@horaya/core";
import { useRouter } from "@tanstack/react-router";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cancelPendingPassAction, markPassPaidAction } from "@/functions/passes";

/** Moyens notés à la main pour une carte (le bon cadeau n'en fait pas partie). */
export const METHOD_LABELS: Record<Exclude<PaymentMethod, "gift_card">, string> = {
  cash: "Espèces",
  card: "Carte bancaire",
  check: "Chèque",
  transfer: "Virement",
};

/** « Marquer payée » (moyen facultatif) ou annuler une vente jamais réglée. */
export function PassPaymentActions({ passId }: { passId: string }) {
  const router = useRouter();
  const [method, setMethod] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (work: () => Promise<{ error?: string } | undefined>) =>
    start(async () => {
      setError((await work())?.error ?? null);
      await router.invalidate();
    });
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          variant="compact"
          aria-label="Moyen de paiement"
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          className="w-40"
        >
          <option value="">Moyen : non précisé</option>
          {Object.entries(METHOD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Button
          size="xs"
          pending={pending}
          onClick={() => run(() => markPassPaidAction(passId, method))}
        >
          Marquer payée
        </Button>
        <Button
          size="xs"
          variant="secondary"
          disabled={pending}
          onClick={() => run(() => cancelPendingPassAction(passId))}
        >
          Annuler
        </Button>
      </div>
      {error && <p className="animate-drop text-[13px] font-semibold text-danger">{error}</p>}
    </div>
  );
}

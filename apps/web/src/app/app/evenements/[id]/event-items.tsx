"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { ItemTile } from "@/components/app/item-tile";
import { Button, IconButton, textLinkClasses } from "@/components/ui/button";
import { MonoCaption } from "@/components/ui/cells";
import { inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Select } from "@/components/ui/select";
import { compactUnitLabels } from "@/lib/format";
import { removeEventItemAction, setEventItemAction } from "../actions";

interface Reserved {
  itemId: string;
  name: string;
  reference: string;
  quantity: number;
  units: string;
}

interface Candidate {
  id: string;
  name: string;
  reference: string;
  units: number;
  /** Exemplaires libres sur la période de l'événement (ceux déjà pris par l'événement compris). */
  free: number;
}

/** Onglet « Matériel » d'un événement : exemplaires bloqués sur ses dates. */
export function EventItems({
  eventId,
  reserved,
  candidates,
  editable,
}: {
  eventId: string;
  reserved: Reserved[];
  candidates: Candidate[];
  editable: boolean;
}) {
  const router = useRouter();
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const reservedIds = new Set(reserved.map((entry) => entry.itemId));
  const options = candidates.filter((candidate) => !reservedIds.has(candidate.id));
  const selected = options.find((candidate) => candidate.id === itemId);
  const freeFor = (id: string) => candidates.find((candidate) => candidate.id === id)?.free ?? 0;

  const run = (action: () => Promise<{ error?: string }>, onSuccess?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      onSuccess?.();
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-6 px-4 py-8 sm:px-10">
      {error && <FormAlert>{error}</FormAlert>}
      {reserved.length === 0 ? (
        <p className="border-2 border-dashed border-ink-subtle px-5 py-8 text-center text-sm font-medium text-ink-muted">
          Aucun matériel réservé pour cet événement. Les exemplaires ajoutés sont bloqués sur ses
          dates et suivent l'événement s'il change d'horaire.
        </p>
      ) : (
        <ul className="flex flex-col border-t-2 border-ink">
          {reserved.map((entry) => (
            <li
              key={entry.itemId}
              className="flex flex-wrap items-center gap-4 border-b border-line-soft py-3.5"
            >
              <ItemTile name={entry.name} reference={entry.reference} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link
                  href={`/app/materiel/${entry.itemId}`}
                  className="truncate text-base font-bold text-ink hover:underline"
                >
                  {entry.name}
                </Link>
                <MonoCaption>
                  Réf. {entry.reference} · ex. {compactUnitLabels(entry.units)}
                </MonoCaption>
              </div>
              {editable ? (
                <div className="flex items-center gap-2">
                  <IconButton
                    label="Un exemplaire de moins"
                    disabled={pending || entry.quantity <= 1}
                    onClick={() =>
                      run(() => setEventItemAction(eventId, entry.itemId, entry.quantity - 1))
                    }
                  >
                    <span aria-hidden="true" className="text-lg font-bold leading-none">
                      −
                    </span>
                  </IconButton>
                  <span className="w-10 text-center font-mono text-sm font-semibold">
                    {entry.quantity}
                  </span>
                  <IconButton
                    label="Un exemplaire de plus"
                    disabled={pending || entry.quantity >= freeFor(entry.itemId)}
                    onClick={() =>
                      run(() => setEventItemAction(eventId, entry.itemId, entry.quantity + 1))
                    }
                  >
                    <span aria-hidden="true" className="text-lg font-bold leading-none">
                      +
                    </span>
                  </IconButton>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => removeEventItemAction(eventId, entry.itemId))}
                    className={`${textLinkClasses} ml-1 px-2 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    Retirer
                  </button>
                </div>
              ) : (
                <span className="font-mono text-sm font-semibold">{entry.quantity} ex.</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selected) return;
            run(
              () => setEventItemAction(eventId, selected.id, Math.max(1, Number(quantity) || 1)),
              () => {
                setItemId("");
                setQuantity("1");
              },
            );
          }}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <label htmlFor={`${formId}-item`} className="text-sm font-bold text-ink">
              Ajouter du matériel
            </label>
            <Select
              id={`${formId}-item`}
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
            >
              <option value="" disabled>
                {options.length === 0 ? "Aucun autre article" : "Choisis un article"}
              </option>
              {options.map((candidate) => (
                <option key={candidate.id} value={candidate.id} disabled={candidate.free === 0}>
                  {candidate.name} ·{" "}
                  {candidate.free === 0
                    ? "aucun libre sur ces dates"
                    : `${candidate.free} libre${candidate.free > 1 ? "s" : ""} sur ${candidate.units}`}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2 sm:w-28">
            <label htmlFor={`${formId}-quantity`} className="text-sm font-bold text-ink">
              Quantité
            </label>
            <input
              id={`${formId}-quantity`}
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ""))}
              className={inputClasses("md", "none")}
            />
          </div>
          <Button type="submit" pending={pending} disabled={!selected}>
            Réserver
          </Button>
        </form>
      )}
    </div>
  );
}

import type { EquipmentOffer } from "@horaya/core";
import { useState } from "react";
import { Collapse } from "@/components/motion/collapse";
import { Checkbox, FieldError } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

/**
 * Module Matériel avancé, formulaire d'inscription : ce que l'atelier réserve avec la place
 * (obligatoire), la case du matériel facultatif et le choix de l'exemplaire quand l'élève
 * décide. Les champs `eq.<besoin>.wanted` et `eq.<besoin>.unit` sont lus par le serveur.
 */
export function EquipmentChoices({
  offers,
  seats,
  errors,
}: {
  offers: EquipmentOffer[];
  seats: number;
  errors: Record<string, string>;
}) {
  if (offers.length === 0) return null;
  return (
    <div className="flex flex-col gap-3.5 rounded-[18px] bg-field p-[18px]">
      <p className="text-sm font-bold leading-[18px] text-ink">Ton matériel</p>
      {offers.map((offer) => (
        <EquipmentOfferRow
          key={offer.needId}
          offer={offer}
          seats={seats}
          error={errors[`equipment.${offer.needId}`]}
        />
      ))}
    </div>
  );
}

function EquipmentOfferRow({
  offer,
  seats,
  error,
}: {
  offer: EquipmentOffer;
  seats: number;
  error: string | undefined;
}) {
  const quantity = offer.perSeat * seats;
  const [wanted, setWanted] = useState(false);
  const [picked, setPicked] = useState(() =>
    Array.from({ length: quantity }, (_, slot) => ({ slot, value: "" })),
  );
  const soldOut = offer.available < quantity;
  const choosing = offer.chooser === "student" && (offer.required || wanted);
  const pick = (slot: number, unitId: string) =>
    setPicked((current) =>
      current.map((entry) => (entry.slot === slot ? { slot, value: unitId } : entry)),
    );
  const taken = picked.map((entry) => entry.value);

  return (
    <div className="flex flex-col gap-2.5">
      {offer.required ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold leading-5 text-ink">
            {offer.name}
            {quantity > 1 ? ` · ${quantity} exemplaires` : ""}
          </p>
          <p className="text-[13px] leading-[18px] text-ink-muted">
            {offer.chooser === "student"
              ? `Inclus avec ${seats > 1 ? "tes places" : "ta place"} : choisis ${quantity > 1 ? "tes exemplaires" : "ton exemplaire"}.`
              : `Inclus avec ${seats > 1 ? "tes places" : "ta place"} : l'atelier te l'attribue.`}
          </p>
        </div>
      ) : (
        <Checkbox
          name={`eq.${offer.needId}.wanted`}
          checked={wanted}
          disabled={soldOut}
          onChange={(event) => setWanted(event.target.checked)}
          label={
            soldOut
              ? `${offer.name} : plus disponible`
              : `Ajouter : ${offer.name}${quantity > 1 ? ` (${quantity})` : ""}`
          }
        />
      )}
      {soldOut && offer.required && (
        <p className="text-[13px] leading-[18px] text-danger">
          Plus assez de matériel pour {seats > 1 ? `${seats} places` : "cette place"} : contacte
          l'atelier.
        </p>
      )}
      <Collapse open={choosing && !soldOut}>
        <div className="flex flex-col gap-2">
          {picked.map(({ slot, value }) => (
            <Select
              key={slot}
              name={`eq.${offer.needId}.unit`}
              value={value}
              onChange={(event) => pick(slot, event.target.value)}
              aria-label={quantity > 1 ? `${offer.name}, exemplaire ${slot + 1}` : offer.name}
              aria-invalid={error ? true : undefined}
              required={choosing}
            >
              <option value="">Choisis ton exemplaire…</option>
              {offer.options.map((option) => (
                <option
                  key={option.unitId}
                  value={option.unitId}
                  disabled={taken.includes(option.unitId) && value !== option.unitId}
                >
                  {option.label}
                </option>
              ))}
            </Select>
          ))}
        </div>
      </Collapse>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

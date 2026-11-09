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
  linked = {},
  optionNames = {},
}: {
  offers: EquipmentOffer[];
  seats: number;
  errors: Record<string, string>;
  /** Matériel facultatif lié à une option payante : places qui la prennent (l'option fait la case). */
  linked?: Readonly<Record<string, number>>;
  optionNames?: Readonly<Record<string, string>>;
}) {
  // Un matériel lié à une option n'apparaît ici que si l'option est prise.
  const shown = offers.filter((offer) => (linked[offer.needId] ?? 1) > 0);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-col gap-3.5 rounded-[18px] bg-field p-[18px]">
      <p className="text-sm font-bold leading-[18px] text-ink">Ton matériel</p>
      {shown.map((offer) => (
        <EquipmentOfferRow
          key={offer.needId}
          offer={offer}
          seats={seats}
          linkedSeats={linked[offer.needId]}
          optionName={optionNames[offer.needId]}
          error={errors[`equipment.${offer.needId}`]}
        />
      ))}
    </div>
  );
}

function EquipmentOfferRow({
  offer,
  seats,
  linkedSeats,
  optionName,
  error,
}: {
  offer: EquipmentOffer;
  seats: number;
  linkedSeats: number | undefined;
  optionName: string | undefined;
  error: string | undefined;
}) {
  const quantity = offer.perSeat * (linkedSeats ?? seats);
  const [wanted, setWanted] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const soldOut = offer.available < quantity;
  const choosing =
    offer.chooser === "student" && (offer.required || wanted || linkedSeats !== undefined);
  const pick = (slot: number, unitId: string) =>
    setPicked((current) => {
      const next = Array.from({ length: quantity }, (_, index) => current[index] ?? "");
      next[slot] = unitId;
      return next;
    });
  const slots = Array.from({ length: quantity }, (_, slot) => ({
    slot,
    value: picked[slot] ?? "",
  }));
  const taken = slots.map((entry) => entry.value);

  return (
    <div className="flex flex-col gap-2.5">
      {linkedSeats !== undefined ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold leading-5 text-ink">
            {offer.name}
            {quantity > 1 ? ` · ${quantity} exemplaires` : ""}
          </p>
          <p className="text-meta leading-[18px] text-ink-muted">
            {`Avec l'option « ${optionName ?? offer.name} » : `}
            {offer.chooser === "student"
              ? `choisis ${quantity > 1 ? "tes exemplaires" : "ton exemplaire"}.`
              : "l'atelier te l'attribue."}
          </p>
        </div>
      ) : offer.required ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold leading-5 text-ink">
            {offer.name}
            {quantity > 1 ? ` · ${quantity} exemplaires` : ""}
          </p>
          <p className="text-meta leading-[18px] text-ink-muted">
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
      {soldOut && (offer.required || linkedSeats !== undefined) && (
        <p className="text-meta leading-[18px] text-danger">
          Plus assez de matériel pour {seats > 1 ? `${seats} places` : "cette place"} : contacte
          l'atelier.
        </p>
      )}
      <Collapse open={choosing && !soldOut}>
        <div className="flex flex-col gap-2">
          {slots.map(({ slot, value }) => (
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

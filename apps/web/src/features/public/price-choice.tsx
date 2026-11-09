import {
  defaultRate,
  type EventModules,
  optionNeedSeats,
  type PriceOption,
  type PriceSelection,
  quoteBooking,
  type Rate,
  ratesOf,
} from "@horaya/core";
import { useState } from "react";
import { choiceTileClasses, choiceTileMutedClasses } from "@/components/public/choice-tile";
import { Checkbox } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

type Priced = {
  priceCents: number;
  paymentMode: "free" | "online" | "deposit" | "on_site";
  modules: EventModules;
};

/**
 * Choix du prix (lot 35) : un tarif par participant, les options par participant ou pour
 * l'inscription. Le total vient de `quoteBooking`, la même fonction que le serveur.
 */
export function usePriceChoice(event: Priced, seats: number) {
  const pricing = event.modules.pricing;
  const fallback = pricing ? defaultRate(pricing).id : (ratesOf(event)[0]?.id ?? "");
  const [rates, setRates] = useState<string[]>(() => Array.from({ length: seats }, () => fallback));
  /** Quantité de chaque option : une valeur par place (option par participant), sinon une seule. */
  const [quantities, setQuantities] = useState<Record<string, number[]>>({});
  const options = pricing?.options ?? [];
  const known = (id: string | undefined) =>
    id !== undefined && ratesOf(event).some((rate) => rate.id === id) ? id : fallback;
  const selection: PriceSelection = {
    rates: Array.from({ length: seats }, (_, seat) => known(rates[seat])),
    options: Object.fromEntries(
      options.map((option) => [
        option.id,
        (quantities[option.id] ?? [])
          .slice(0, option.per === "participant" ? seats : 1)
          .reduce((total, quantity) => total + quantity, 0),
      ]),
    ),
  };
  let quote: ReturnType<typeof quoteBooking>;
  try {
    quote = quoteBooking(event, seats, selection);
  } catch {
    quote = quoteBooking(event, seats);
  }
  return {
    /** Le module est actif : tarifs et options s'affichent. */
    visible: Boolean(pricing) && event.paymentMode !== "free",
    rates: ratesOf(event),
    options,
    selection,
    quote,
    /** Matériel facultatif lié à une option : places qui le prennent, besoin par besoin. */
    linked: optionNeedSeats(event, seats, quote.lines),
    rateOf: (seat: number) => known(rates[seat]),
    setRate: (seat: number, id: string) =>
      setRates((current) => current.map((value, index) => (index === seat ? id : value))),
    quantity: (option: PriceOption, seat: number) => quantities[option.id]?.[seat] ?? 0,
    setQuantity: (option: PriceOption, seat: number, value: number) =>
      setQuantities((current) => {
        const list = [...(current[option.id] ?? [])];
        list[seat] = value;
        return { ...current, [option.id]: Array.from(list, (entry) => entry ?? 0) };
      }),
  };
}

export type PriceChoice = ReturnType<typeof usePriceChoice>;

/** Les tarifs en tuiles : celle choisie est pleine, de la couleur de l'atelier (lot 37). */
export function RateTiles({
  rates,
  value,
  onChange,
  name,
}: {
  rates: Rate[];
  value: string;
  onChange: (id: string) => void;
  /** Nom du groupe de boutons radio (un par participant). */
  name: string;
}) {
  if (rates.length < 2) return null;
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="pb-1.5 text-label font-semibold leading-4 text-ink">Tarif</legend>
      <div className="grid grid-cols-2 gap-1.5 sm:flex">
        {rates.map((rate) => (
          <label
            key={rate.id}
            className={cn(
              choiceTileClasses(value === rate.id),
              "flex min-w-0 grow basis-0 cursor-pointer flex-col gap-px px-2.5 py-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
            )}
          >
            <input
              type="radio"
              name={name}
              value={rate.id}
              checked={value === rate.id}
              onChange={() => onChange(rate.id)}
              className="sr-only"
            />
            <span className="text-meta font-semibold leading-4">{rate.name}</span>
            <span
              className={cn("text-label leading-[15px]", choiceTileMutedClasses(value === rate.id))}
            >
              {formatMoney(rate.priceCents)}
              {rate.description && ` · ${rate.description}`}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Options en cases avec leur prix ; une quantité maximale au-delà de 1 donne un compteur. */
export function OptionRows({
  options,
  quantity,
  onChange,
  max = 1,
}: {
  options: PriceOption[];
  quantity: (option: PriceOption) => number;
  onChange: (option: PriceOption, value: number) => void;
  /** Multiplie la quantité maximale (comptoir : places de l'inscription). */
  max?: number;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 pt-0.5">
      {options.map((option) => {
        const limit = (option.max ?? 1) * max;
        return (
          <div key={option.id} className="flex items-center justify-between gap-3">
            {limit > 1 ? (
              <span className="text-sm font-semibold leading-5 text-ink">{option.name}</span>
            ) : (
              <Checkbox
                label={option.name}
                checked={quantity(option) > 0}
                onChange={(event) => onChange(option, event.target.checked ? 1 : 0)}
              />
            )}
            <span className="flex shrink-0 items-center gap-3">
              <span className="text-meta leading-4 text-ink-muted">
                + {formatMoney(option.priceCents)}
              </span>
              {limit > 1 && (
                <Stepper
                  value={quantity(option)}
                  onChange={(value) => onChange(option, value)}
                  min={0}
                  max={limit}
                  label={option.name}
                />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Ce qu'un participant choisit : son tarif et ses options. */
export function SeatPrice({ choice, seat }: { choice: PriceChoice; seat: number }) {
  if (!choice.visible) return null;
  const perSeat = choice.options.filter((option) => option.per === "participant");
  if (choice.rates.length < 2 && perSeat.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <RateTiles
        rates={choice.rates}
        value={choice.rateOf(seat)}
        onChange={(id) => choice.setRate(seat, id)}
        name={`tarif-${seat}`}
      />
      <OptionRows
        options={perSeat}
        quantity={(option) => choice.quantity(option, seat)}
        onChange={(option, value) => choice.setQuantity(option, seat, value)}
      />
    </div>
  );
}

/** Options « une fois par inscription ». */
export function BookingOptions({ choice }: { choice: PriceChoice }) {
  if (!choice.visible) return null;
  const once = choice.options.filter((option) => option.per === "booking");
  if (once.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 rounded-[18px] bg-field p-[18px]">
      <p className="text-sm font-bold leading-[18px] text-ink">Options</p>
      <OptionRows
        options={once}
        quantity={(option) => choice.quantity(option, 0)}
        onChange={(option, value) => choice.setQuantity(option, 0, value)}
      />
    </div>
  );
}

/** Le détail du prix, une ligne par tarif et par option. */
export function PriceLines({ lines }: { lines: ReturnType<typeof quoteBooking>["lines"] }) {
  return (
    <>
      {lines.map((line) => (
        <p
          key={`${line.kind}-${line.id}`}
          className="flex justify-between gap-4 text-sm leading-[18px]"
        >
          <span className="text-ink/85">
            {line.kind === "rate"
              ? `${line.quantity} × ${line.label}`
              : `${line.label}${line.quantity > 1 ? ` × ${line.quantity}` : ""}`}
          </span>
          <span className="font-semibold text-ink">{formatMoney(line.totalCents)}</span>
        </p>
      ))}
    </>
  );
}

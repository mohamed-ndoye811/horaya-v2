"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { ArrowRight } from "@/components/ui/icons";
import { formatMoney } from "@/lib/format";
import { Link } from "@/lib/navigation";

/** Carte de réservation de la maquette 5.2 : nombre de places, total, puis l'étape suivante. */
export function SeatPicker({
  bookHref,
  priceCents,
  maxSeats,
  label,
}: {
  bookHref: string;
  priceCents: number;
  maxSeats: number;
  /** « Réserver mes places », « Rejoindre la liste d'attente »… */
  label: string;
}) {
  const [seats, setSeats] = useState(1);
  const step =
    "flex size-[38px] items-center justify-center rounded-full border border-line text-xl leading-5 text-ink transition-colors hover:bg-field disabled:cursor-not-allowed disabled:text-line disabled:hover:bg-transparent";
  return (
    <>
      <div className="flex items-center justify-between gap-4 border-y border-bg py-3.5">
        <span aria-hidden="true" className="text-[15px] font-semibold leading-5 text-ink">
          Nombre de places
        </span>
        <fieldset className="flex items-center gap-3.5">
          <legend className="sr-only">Nombre de places</legend>
          <button
            type="button"
            aria-label="Une place de moins"
            disabled={seats <= 1}
            onClick={() => setSeats(seats - 1)}
            className={step}
          >
            −
          </button>
          <output aria-live="polite" className="min-w-4 text-center text-xl font-semibold text-ink">
            {seats}
          </output>
          <button
            type="button"
            aria-label="Une place de plus"
            disabled={seats >= maxSeats}
            onClick={() => setSeats(seats + 1)}
            className={step}
          >
            +
          </button>
        </fieldset>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm leading-[18px] text-ink-muted">
          {priceCents > 0 ? `${seats} × ${formatMoney(priceCents)}` : "Total"}
        </span>
        <span className="text-2xl font-semibold leading-7 text-ink">
          {priceCents > 0 ? formatMoney(priceCents * seats) : "Gratuit"}
        </span>
      </div>
      <Link
        href={`${bookHref}${bookHref.includes("?") ? "&" : "?"}places=${seats}`}
        className={buttonClasses({ variant: "brand", size: "xl", className: "w-full" })}
      >
        {label}
        <ArrowRight />
      </Link>
    </>
  );
}

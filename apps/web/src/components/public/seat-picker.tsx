"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "@/components/ui/icons";
import { formatMoney } from "@/lib/format";

/** Carte de réservation de l'écran 10 : nombre de places, total, puis étape 2. */
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
    "flex size-10 items-center justify-center text-ink transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:text-ink-subtle disabled:hover:bg-transparent";
  return (
    <>
      <div className="flex items-center justify-between gap-4 border-b border-line-soft px-6 py-5">
        <span aria-hidden="true" className="text-[15px] font-bold text-ink">
          Nombre de places
        </span>
        <fieldset className="flex items-center border-2 border-ink">
          <legend className="sr-only">Nombre de places</legend>
          <button
            type="button"
            aria-label="Une place de moins"
            disabled={seats <= 1}
            onClick={() => setSeats(seats - 1)}
            className={step}
          >
            <span aria-hidden="true" className="h-0.5 w-3 bg-current" />
          </button>
          <output
            aria-live="polite"
            className="flex h-10 w-11 items-center justify-center border-x-2 border-ink font-mono text-base font-semibold text-ink"
          >
            {seats}
          </output>
          <button
            type="button"
            aria-label="Une place de plus"
            disabled={seats >= maxSeats}
            onClick={() => setSeats(seats + 1)}
            className={step}
          >
            <span aria-hidden="true" className="relative size-3">
              <span className="absolute top-[5px] left-0 h-0.5 w-3 bg-current" />
              <span className="absolute top-0 left-[5px] h-3 w-0.5 bg-current" />
            </span>
          </button>
        </fieldset>
      </div>
      <div className="flex items-center justify-between px-6 pt-5 pb-1">
        <span className="text-[15px] font-semibold text-ink-muted">Total</span>
        <span className="text-2xl font-extrabold text-ink">
          {priceCents > 0 ? formatMoney(priceCents * seats) : "Gratuit"}
        </span>
      </div>
      <div className="px-6 pt-4">
        <Link
          href={`${bookHref}${bookHref.includes("?") ? "&" : "?"}places=${seats}`}
          className="flex h-14 items-center justify-center gap-3 bg-ink text-[17px] font-extrabold text-on-ink transition-colors hover:bg-info"
        >
          {label}
          <ArrowRight />
        </Link>
      </div>
    </>
  );
}

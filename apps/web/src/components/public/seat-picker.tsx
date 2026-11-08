"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { formatMoney } from "@/lib/format";

/** Carte de réservation de la maquette 5.2 : nombre de places, total, puis l'étape suivante. */
export function SeatPicker({
  bookHref,
  priceCents,
  maxSeats,
  label,
  note,
}: {
  bookHref: string;
  priceCents: number;
  maxSeats: number;
  /** « Réserver mes places », « Rejoindre la liste d'attente »… */
  label: string;
  /** Tarifs et options au choix (« Plein 45 € · Réduit 35 € · options à l'étape suivante »). */
  note?: string | null;
}) {
  const [seats, setSeats] = useState(1);
  return (
    <>
      <div className="flex items-center justify-between gap-4 border-y border-bg py-3.5">
        <span aria-hidden="true" className="text-[15px] font-semibold leading-5 text-ink">
          Nombre de places
        </span>
        <Stepper
          value={seats}
          onChange={setSeats}
          min={1}
          max={maxSeats}
          label="Nombre de places"
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm leading-[18px] text-ink-muted">
          {priceCents > 0 ? `${seats} × ${formatMoney(priceCents)}` : "Total"}
        </span>
        <span className="text-2xl font-semibold leading-7 text-ink">
          {priceCents > 0 ? formatMoney(priceCents * seats) : "Gratuit"}
        </span>
      </div>
      {note && <p className="-mt-2 text-[13px] leading-[18px] text-ink-muted">{note}</p>}
      <ButtonLink
        href={`${bookHref}${bookHref.includes("?") ? "&" : "?"}places=${seats}`}
        variant="brand"
        size="xl"
        arrow
        className="w-full"
      >
        {label}
      </ButtonLink>
    </>
  );
}

import { addDays, toZonedParts } from "@horaya/core";
import { centsToInput } from "@/lib/money";
import type { EventFormValues } from "./event-form";

const pad = (value: number) => String(value).padStart(2, "0");

/** Date et heure locales (fuseau de l'espace) pour les champs du formulaire. */
export function toInputs(date: Date, timeZone: string): { date: string; time: string } {
  const parts = toZonedParts(date, timeZone);
  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}

/** Valeurs d'un nouvel événement : demain (ou le jour choisi dans le calendrier) de 14 h à 16 h. */
export function emptyEventValues(
  timeZone: string,
  day?: { year: number; month: number; day: number },
): EventFormValues {
  const today = toZonedParts(new Date(), timeZone);
  const date = day ?? addDays(today, 1);
  const iso = `${date.year}-${pad(date.month)}-${pad(date.day)}`;
  return {
    title: "",
    eventTypeId: "",
    description: "",
    startDate: iso,
    startTime: "14:00",
    endDate: iso,
    endTime: "16:00",
    locationName: "",
    onlineUrl: "",
    capacity: "",
    price: "",
    paymentMode: "free",
    depositPercent: "",
    requiresApproval: false,
    visibility: "public",
  };
}

export function eventToValues(
  event: {
    title: string;
    typeId: string;
    description: string;
    startsAt: Date;
    endsAt: Date;
    locationName: string | null;
    onlineUrl: string | null;
    capacity: number | null;
    priceCents: number;
    paymentMode: string;
    depositPercent: number | null;
    requiresApproval: boolean;
    visibility: string;
  },
  timeZone: string,
): EventFormValues {
  const start = toInputs(event.startsAt, timeZone);
  const end = toInputs(event.endsAt, timeZone);
  return {
    title: event.title,
    eventTypeId: event.typeId,
    description: event.description,
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    locationName: event.locationName ?? "",
    onlineUrl: event.onlineUrl ?? "",
    capacity: event.capacity === null ? "" : String(event.capacity),
    price: event.priceCents > 0 ? centsToInput(event.priceCents) : "",
    paymentMode: event.paymentMode,
    depositPercent: event.depositPercent === null ? "" : String(event.depositPercent),
    requiresApproval: event.requiresApproval,
    visibility: event.visibility,
  };
}

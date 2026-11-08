import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { formDataInput } from "@/lib/form-data";
import { searchText } from "@/lib/search-params";
import type { FormState } from "@/server/form-state";
import { createPublicBooking } from "@/server/public-booking";
import { holdPublicSlot, slotBookPage, slotPage } from "@/server/slots";

/** Créneaux (lot 37) : pages publiques d'un type « sur rendez-vous » et leurs actions. */
const slug = z.string().max(80);
const typeId = z.string().uuid();

export const slotSearch = z.object({ duree: searchText, semaine: searchText });

export const getSlotPage = createServerFn({ method: "GET" })
  .validator(z.object({ slug, typeId, search: slotSearch }))
  .handler(({ data }) => slotPage(data.slug, data.typeId, data.search));

export const getSlotBookPage = createServerFn({ method: "GET" })
  .validator(z.object({ slug, typeId, holdId: searchText }))
  .handler(({ data }) => slotBookPage(data.slug, data.typeId, data.holdId));

const holdFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => {
    const text = (key: string) => String(data.get(key) ?? "").trim();
    return holdPublicSlot(text("_slug"), text("_type"), {
      startsAt: text("startsAt"),
      durationId: text("durationId") || null,
      staffMemberId: text("staffMemberId") || null,
    });
  });

/** « Continuer » : garde le créneau choisi, puis ouvre le formulaire. */
export function holdSlotAction(slug: string, typeId: string, _previous: FormState, form: FormData) {
  form.set("_slug", slug);
  form.set("_type", typeId);
  return holdFn({ data: form });
}

const bookFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) =>
    createPublicBooking(
      String(data.get("_slug") ?? ""),
      "",
      null,
      Math.max(1, Math.trunc(Number(data.get("_seats")) || 1)),
      data,
      String(data.get("_hold") ?? ""),
    ),
  );

/** Formulaire du créneau gardé : coordonnées, puis réservation (l'événement naît ici). */
export function createSlotBookingAction(
  slug: string,
  holdId: string,
  seats: number,
  _previous: FormState,
  form: FormData,
) {
  form.set("_slug", slug);
  form.set("_hold", holdId);
  form.set("_seats", String(seats));
  return bookFn({ data: form });
}

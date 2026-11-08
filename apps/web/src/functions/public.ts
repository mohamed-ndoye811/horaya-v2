import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { formDataInput } from "@/lib/form-data";
import {
  cancelAbsence,
  cancelStageEnrollment,
  createPublicEnrollment,
  enrollEventPage,
  reportAbsence,
} from "@/server/enrollments";
import type { FormState } from "@/server/form-state";
import {
  bookEventPage,
  calendarLinkPage,
  cancelManagedBooking,
  createPublicBooking,
  managedBookingPage,
  payManagedBooking,
  publicEventPage,
  publicHome,
  publicLayout,
  resendBookingEmail,
} from "@/server/public-booking";

/*
 * Pages publiques d'un espace : aucune session, l'adresse de l'espace suffit. Les actions
 * gardent les noms des anciennes Server Actions : les composants n'ont pas changé.
 */
const slug = z.string().max(80);
const withToken = z.object({ slug, token: z.string().max(200) });

export const getPublicWorkspace = createServerFn({ method: "GET" })
  .validator(slug)
  .handler(({ data }) => publicLayout(data));

export const getPublicHome = createServerFn({ method: "GET" })
  .validator(slug)
  .handler(({ data }) => publicHome(data));

export const getCalendarLinkPage = createServerFn({ method: "GET" })
  .validator(z.object({ slug, lien: z.string().max(80) }))
  .handler(({ data }) => calendarLinkPage(data.slug, data.lien));

export const getPublicEventPage = createServerFn({ method: "GET" })
  .validator(z.object({ slug, event: z.string().max(200), lien: z.string().optional() }))
  .handler(({ data }) => publicEventPage(data.slug, data.event, data.lien));

export const getBookEventPage = createServerFn({ method: "GET" })
  .validator(
    z.object({
      slug,
      event: z.string().max(200),
      lien: z.string().optional(),
      places: z.string().optional(),
    }),
  )
  .handler(({ data }) => bookEventPage(data.slug, data.event, data.lien, data.places));

/** Inscription à toute la série depuis la fiche d'un cours. */
export const getEnrollEventPage = createServerFn({ method: "GET" })
  .validator(z.object({ slug, event: z.string().max(200) }))
  .handler(({ data }) => enrollEventPage(data.slug, data.event));

export const getManagedBookingPage = createServerFn({ method: "GET" })
  .validator(withToken)
  .handler(({ data }) => managedBookingPage(data.slug, data.token));

/* ---------- Actions ---------- */

const bookFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) =>
    createPublicBooking(
      String(data.get("_slug") ?? ""),
      String(data.get("_event") ?? ""),
      String(data.get("_link") ?? "") || null,
      // Le core revérifie le nombre de places (minimum, maximum par réservation, restantes).
      Math.max(1, Math.trunc(Number(data.get("_seats")) || 1)),
      data,
    ),
  );
const enrollFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) =>
    createPublicEnrollment(String(data.get("_slug") ?? ""), String(data.get("_event") ?? ""), data),
  );
const absenceFn = createServerFn({ method: "POST" })
  .validator(withToken.extend({ eventId: z.string().uuid() }))
  .handler(({ data }) => reportAbsence(data.slug, data.token, data.eventId));
const cancelAbsenceFn = createServerFn({ method: "POST" })
  .validator(withToken.extend({ eventId: z.string().uuid() }))
  .handler(({ data }) => cancelAbsence(data.slug, data.token, data.eventId));
const cancelStageFn = createServerFn({ method: "POST" })
  .validator(withToken)
  .handler(({ data }) => cancelStageEnrollment(data.slug, data.token));
const payFn = createServerFn({ method: "POST" })
  .validator(withToken)
  .handler(({ data }) => payManagedBooking(data.slug, data.token));
const cancelFn = createServerFn({ method: "POST" })
  .validator(withToken)
  .handler(({ data }) => cancelManagedBooking(data.slug, data.token));
const resendFn = createServerFn({ method: "POST" })
  .validator(withToken)
  .handler(({ data }) => resendBookingEmail(data.slug, data.token));

/** Étape 2 (écran 18) : coordonnées des participants, puis réservation au nom du client. */
export function createPublicBookingAction(
  slug: string,
  eventSlug: string,
  linkSlug: string | null,
  seats: number,
  _previous: FormState,
  form: FormData,
) {
  form.set("_slug", slug);
  form.set("_event", eventSlug);
  form.set("_link", linkSlug ?? "");
  form.set("_seats", String(seats));
  return bookFn({ data: form });
}

/** « Inscris-toi pour tout le trimestre » : coordonnées, puis inscription à la série. */
export function createPublicEnrollmentAction(
  slug: string,
  eventSlug: string,
  _previous: FormState,
  form: FormData,
) {
  form.set("_slug", slug);
  form.set("_event", eventSlug);
  return enrollFn({ data: form });
}

/** « Je serai absent·e » sur une séance d'une inscription (lien de gestion). */
export const reportAbsenceAction = (slug: string, token: string, eventId: string) =>
  absenceFn({ data: { slug, token, eventId } });

/** « Annuler mon absence » sur une séance d'une inscription (lien de gestion). */
export const cancelAbsenceAction = (slug: string, token: string, eventId: string) =>
  cancelAbsenceFn({ data: { slug, token, eventId } });

/** Reprend un paiement abandonné : redirige (erreur de redirection) vers la page de paiement. */
export const payManagedBookingAction = (slug: string, token: string) =>
  payFn({ data: { slug, token } });
export const cancelManagedBookingAction = (slug: string, token: string) =>
  cancelFn({ data: { slug, token } });
export const resendBookingEmailAction = (slug: string, token: string) =>
  resendFn({ data: { slug, token } });

/** Stage : annuler son inscription (toutes les séances), depuis le lien de gestion. */
export const cancelStageEnrollmentAction = (slug: string, token: string) =>
  cancelStageFn({ data: { slug, token } });

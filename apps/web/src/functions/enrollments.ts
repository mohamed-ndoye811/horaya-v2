import type { EnrollInSeriesInput } from "@horaya/core";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { formDataInput } from "@/lib/form-data";
import {
  assignMakeupImpl,
  cancelEnrollmentImpl,
  cancelStageImpl,
  createCounterEnrollmentImpl,
  saveSeriesEnrollment,
  setEnrollmentPaidImpl,
} from "@/server/enrollments";
import type { FormState } from "@/server/form-state";

export type { CounterEnrollmentResult } from "@/server/enrollments";

/*
 * Inscriptions à une série (cours à l'année), côté équipe : onglet « Série » de la fiche
 * événement et comptoir. Le client passe par functions/public.ts (lien de gestion).
 */
const id = z.string().uuid();

const saveFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => saveSeriesEnrollment(String(data.get("_series") ?? ""), data));
const cancelFn = createServerFn({ method: "POST" })
  .validator(id)
  .handler(({ data }) => cancelEnrollmentImpl(data));
const cancelStageFn = createServerFn({ method: "POST" })
  .validator(id)
  .handler(({ data }) => cancelStageImpl(data));
const paidFn = createServerFn({ method: "POST" })
  .validator(z.object({ enrollmentId: id, paid: z.boolean() }))
  .handler(({ data }) => setEnrollmentPaidImpl(data.enrollmentId, data.paid));
const makeupFn = createServerFn({ method: "POST" })
  .validator(z.object({ absentBookingId: id, eventId: id }))
  .handler(({ data }) => assignMakeupImpl(data.absentBookingId, data.eventId));
const counterFn = createServerFn({ method: "POST" })
  // Le cas d'usage du core valide l'entrée (Zod) ; ici, simple passage.
  .validator((input: EnrollInSeriesInput) => input)
  .handler(({ data }) => createCounterEnrollmentImpl(data));

export function saveSeriesEnrollmentAction(seriesId: string, _previous: FormState, form: FormData) {
  form.set("_series", seriesId);
  return saveFn({ data: form });
}
export const cancelEnrollmentAction = (enrollmentId: string) => cancelFn({ data: enrollmentId });
export const setEnrollmentPaidAction = (enrollmentId: string, paid: boolean) =>
  paidFn({ data: { enrollmentId, paid } });
export const createCounterEnrollmentAction = (input: EnrollInSeriesInput) =>
  counterFn({ data: input });
export const assignMakeupAction = (absentBookingId: string, eventId: string) =>
  makeupFn({ data: { absentBookingId, eventId } });
export const cancelStageAction = (seriesId: string) => cancelStageFn({ data: seriesId });

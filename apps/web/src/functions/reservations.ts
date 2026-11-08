import type { CounterBookingInput } from "@horaya/core";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  cancelBookingActionImpl,
  cancelRecreditInfoImpl,
  checkInActionImpl,
  confirmBookingActionImpl,
  counterItemsActionImpl,
  createCounterBookingActionImpl,
  markPaidActionImpl,
  recordRefundActionImpl,
  refundBookingActionImpl,
  refuseBookingActionImpl,
  searchCounterCustomersActionImpl,
} from "@/server/reservations";

export type { CounterResult } from "@/server/reservations";

/*
 * Fonctions serveur (appelées depuis le navigateur) et leurs enveloppes, aux mêmes noms que les
 * anciennes Server Actions : les composants n'ont pas changé. Après une action, le composant
 * recharge les données de la page (router.invalidate).
 */
const id = z.string().uuid();
const withReason = z.object({ bookingId: id, reason: z.string().max(500) });
const cancelWithRecredit = withReason.extend({ recredit: z.boolean().optional() });
const withAmount = z.object({ bookingId: id, amount: z.string().max(20) });

const confirmFn = createServerFn({ method: "POST" })
  .validator(id)
  .handler(({ data }) => confirmBookingActionImpl(data));
const refuseFn = createServerFn({ method: "POST" })
  .validator(withReason)
  .handler(({ data }) => refuseBookingActionImpl(data.bookingId, data.reason));
const cancelFn = createServerFn({ method: "POST" })
  .validator(cancelWithRecredit)
  .handler(({ data }) => cancelBookingActionImpl(data.bookingId, data.reason, data.recredit));
const recreditInfoFn = createServerFn({ method: "GET" })
  .validator(id)
  .handler(({ data }) => cancelRecreditInfoImpl(data));
const checkInFn = createServerFn({ method: "POST" })
  .validator(z.object({ bookingId: id, present: z.boolean() }))
  .handler(({ data }) => checkInActionImpl(data.bookingId, data.present));
const searchCustomersFn = createServerFn({ method: "POST" })
  .validator(z.string().max(200))
  .handler(({ data }) => searchCounterCustomersActionImpl(data));
const counterItemsFn = createServerFn({ method: "POST" })
  .validator(id)
  .handler(({ data }) => counterItemsActionImpl(data));
const createCounterFn = createServerFn({ method: "POST" })
  // Le cas d'usage du core valide l'entrée (Zod) ; ici, simple passage.
  .validator((input: CounterBookingInput) => input)
  .handler(({ data }) => createCounterBookingActionImpl(data));
const refundFn = createServerFn({ method: "POST" })
  .validator(withAmount)
  .handler(({ data }) => refundBookingActionImpl(data.bookingId, data.amount));
const markPaidFn = createServerFn({ method: "POST" })
  .validator(withAmount)
  .handler(({ data }) => markPaidActionImpl(data.bookingId, data.amount));
const recordRefundFn = createServerFn({ method: "POST" })
  .validator(withAmount)
  .handler(({ data }) => recordRefundActionImpl(data.bookingId, data.amount));

export const confirmBookingAction = (bookingId: string) => confirmFn({ data: bookingId });
export const refuseBookingAction = (bookingId: string, reason: string) =>
  refuseFn({ data: { bookingId, reason } });
export const cancelBookingAction = (bookingId: string, reason: string, recredit?: boolean) =>
  cancelFn({ data: { bookingId, reason, recredit } });
/** La case « Recréditer la séance sur la carte » : null si la réservation n'est pas payée avec une carte. */
export const cancelRecreditInfoAction = (bookingId: string) => recreditInfoFn({ data: bookingId });
export const checkInAction = (bookingId: string, present: boolean) =>
  checkInFn({ data: { bookingId, present } });
export const searchCounterCustomersAction = (search: string) => searchCustomersFn({ data: search });
export const counterItemsAction = (eventId: string) => counterItemsFn({ data: eventId });
export const createCounterBookingAction = (input: CounterBookingInput) =>
  createCounterFn({ data: input });
export const refundBookingAction = (bookingId: string, amount: string) =>
  refundFn({ data: { bookingId, amount } });
export const markPaidAction = (bookingId: string, amount: string) =>
  markPaidFn({ data: { bookingId, amount } });
export const recordRefundAction = (bookingId: string, amount: string) =>
  recordRefundFn({ data: { bookingId, amount } });

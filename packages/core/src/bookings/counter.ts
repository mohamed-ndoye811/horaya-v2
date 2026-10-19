import { z } from "zod";
import { type AssignedItem, assignEventItems } from "../inventory/use-cases";
import { recordManualPaymentIn } from "../payments/use-cases";
import { type Actor, assertMemberCan } from "../shared/actor";
import { ConflictError, NotFoundError } from "../shared/errors";
import { generateToken, hashToken } from "../shared/tokens";
import type { Deps } from "../shared/unit-of-work";
import { validate } from "../shared/validate";
import type { Booking } from "./model";
import { PAYMENT_METHODS } from "./types";
import { insertEventBooking } from "./use-cases";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

/** Client créé au comptoir : nom et téléphone suffisent, l'e-mail est facultatif. */
const counterCustomerSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis").max(60),
  lastName: z.string().trim().min(1, "Nom requis").max(60),
  phone: optionalText(30),
  email: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.email("Adresse e-mail invalide").trim().toLowerCase().nullish(),
  ),
});

export const counterBookingSchema = z
  .object({
    eventId: z.uuid(),
    seats: z.int().min(1, "Au moins une place").max(1000),
    /** Client existant, sinon `customer` pour en créer un. */
    customerId: z.uuid().nullish(),
    customer: counterCustomerSchema.nullish(),
    items: z
      .array(z.object({ itemId: z.uuid(), quantity: z.int().min(1).max(500) }))
      .max(50)
      .default([]),
    /** Payé sur place au moment de la saisie (sinon : à payer, lien envoyé par e-mail). */
    paid: z.boolean().default(false),
    paymentMethod: z.enum(PAYMENT_METHODS).nullish(),
  })
  .superRefine((input, context) => {
    if (!input.customerId && !input.customer) {
      context.addIssue({
        code: "custom",
        path: ["customer"],
        message: "Choisis ou crée un client",
      });
    }
    if (input.customer && !input.customer.phone && !input.customer.email) {
      context.addIssue({
        code: "custom",
        path: ["customer", "phone"],
        message: "Un téléphone ou un e-mail",
      });
    }
    const ids = input.items.map((item) => item.itemId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", path: ["items"], message: "Article en double" });
    }
  });
export type CounterBookingInput = z.input<typeof counterBookingSchema>;

/**
 * Comptoir : réservation prise au téléphone ou sur place, en une transaction. Le client
 * (existant ou créé), les places, le matériel attribué et, le cas échéant, le paiement
 * noté. Rien n'est écrit si une étape échoue (plus de place, plus de matériel…).
 */
export async function createCounterBooking(
  deps: Deps,
  actor: Actor,
  input: CounterBookingInput,
): Promise<{ booking: Booking; manageToken: string; items: AssignedItem[] }> {
  assertMemberCan(actor, "booking", "create");
  const data = validate(counterBookingSchema, input);
  const manageToken = generateToken();
  const manageTokenHash = await hashToken(manageToken);

  return deps.uow.run(async (repositories) => {
    const locked = await repositories.events.lockForBooking(actor.organizationId, data.eventId);
    if (!locked) throw new NotFoundError("Événement", data.eventId);
    if (locked.event.status !== "published") {
      throw new ConflictError(
        locked.event.status === "cancelled"
          ? "Cet événement est annulé"
          : "Publie l'événement avant d'y inscrire quelqu'un",
      );
    }
    const now = deps.clock.now();

    let customerId: string;
    if (data.customerId) {
      const customer = await repositories.customers.find(actor.organizationId, data.customerId);
      if (!customer || customer.archivedAt || customer.anonymizedAt) {
        throw new NotFoundError("Client", data.customerId);
      }
      customerId = customer.id;
    } else {
      const contact = data.customer as NonNullable<typeof data.customer>;
      customerId = contact.email
        ? (
            await repositories.customers.upsertByEmail(actor.organizationId, {
              ...contact,
              email: contact.email,
              company: null,
            })
          ).id
        : (
            await repositories.customers.insert(actor.organizationId, {
              ...contact,
              email: null,
              company: null,
              tags: [],
              marketingConsent: false,
            })
          ).id;
    }

    const booking = await insertEventBooking(repositories, actor, locked, now, {
      customerId,
      seats: data.seats,
      participants: [],
      customerMessage: null,
      manageTokenHash,
    });
    if (booking.status !== "confirmed" && (data.items.length > 0 || data.paid)) {
      throw new ConflictError(
        "La séance est complète : la réservation irait en liste d'attente, sans matériel ni paiement",
      );
    }
    const items =
      data.items.length > 0
        ? await assignEventItems(repositories, actor, locked.event, booking.id, data.items)
        : [];
    if (data.paid && booking.amountCents > 0) {
      await recordManualPaymentIn(
        repositories,
        actor,
        booking,
        booking.amountCents,
        data.paymentMethod ?? null,
      );
    }
    const fresh = await repositories.bookings.find(actor.organizationId, booking.id);
    return { booking: fresh ?? booking, manageToken, items };
  });
}

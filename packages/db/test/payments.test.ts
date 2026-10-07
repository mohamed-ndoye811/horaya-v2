import {
  type Actor,
  cancelBookingWithToken,
  completeCheckout,
  createEvent,
  createEventBooking,
  createEventType,
  expireCheckout,
  ForbiddenError,
  type PaymentDeps,
  type PaymentGateway,
  publishEvent,
  refundAfterCancellation,
  refundBooking,
  startCheckout,
} from "@horaya/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { booking as bookingTable, payment } from "../src/schema";
import { repositoriesFor } from "../src/unit-of-work";
import {
  contact,
  createOrganization,
  customerActor,
  db,
  fixedClock,
  member,
  testDeps,
} from "./helpers";

afterAll(() => db.$client.end());

/** Passerelle factice : retient les appels, numérote pages de paiement et remboursements. */
function fakeGateway() {
  const calls = {
    checkoutIds: [] as string[],
    checkouts: [] as Array<{ amountCents: number; accountId: string }>,
    refunds: [] as Array<{ amountCents: number; paymentReference: string }>,
  };
  let next = 0;
  const run = Math.random().toString(36).slice(2, 8);
  const gateway: PaymentGateway = {
    provider: "test",
    createAccount: async () => ({ accountId: "acct_test_1" }),
    createOnboardingLink: async () => ({ url: "https://connect.test/onboarding" }),
    getAccount: async () => ({ status: "active", displayName: "Cabinet Vidal" }),
    createCheckout: async (input) => {
      calls.checkouts.push(input);
      calls.checkoutIds.push(`cs_${run}_${next + 1}`);
      return { checkoutId: `cs_${run}_${++next}`, url: `https://pay.test/cs_${run}_${next}` };
    },
    refund: async (input) => {
      calls.refunds.push(input);
      return { refundId: `re_${run}_${++next}` };
    },
    getBalance: async () => null,
  };
  return { gateway, calls };
}

let organizationId: string;
let owner: Actor;
let deps: PaymentDeps;
let calls: ReturnType<typeof fakeGateway>["calls"];
/** Identifiant de la n-ième page de paiement ouverte dans le test. */
let checkout: (index?: number) => string;

beforeEach(async () => {
  organizationId = await createOrganization();
  owner = member(organizationId);
  const fake = fakeGateway();
  calls = fake.calls;
  checkout = (index = 0) => calls.checkoutIds[index] ?? "";
  deps = { ...testDeps(fixedClock()), payments: fake.gateway };
  await repositoriesFor(db).settings.setPaymentAccount(organizationId, "acct_test_1", "active");
});

async function paidEvent(paymentMode: "online" | "deposit", capacity = 10) {
  const type = await createEventType(deps, owner, {
    name: `Atelier ${Math.random()}`,
    color: "#D8BC66",
  });
  const [created] = await createEvent(deps, owner, {
    eventTypeId: type.id,
    title: "Atelier poterie",
    startsAt: "2026-10-20T09:00:00Z",
    endsAt: "2026-10-20T11:00:00Z",
    timezone: "Europe/Paris",
    capacity,
    priceCents: 3500,
    paymentMode,
    depositPercent: paymentMode === "deposit" ? 30 : null,
  });
  if (!created) throw new Error("événement");
  return publishEvent(deps, owner, created.id);
}

const urls = { description: "Atelier poterie", successUrl: "https://ok", cancelUrl: "https://ko" };
const statusOf = async (id: string) =>
  (await db.select().from(bookingTable).where(eq(bookingTable.id, id)))[0]?.paymentStatus;

describe("paiement en ligne", () => {
  it("encaisse, reste idempotent, puis rembourse tout à une annulation dans les délais", async () => {
    const event = await paidEvent("online");
    const { booking, manageToken } = await createEventBooking(deps, customerActor(organizationId), {
      eventId: event.id,
      seats: 2,
      customer: contact(),
    });
    await startCheckout(deps, organizationId, booking.id, urls);
    expect(calls.checkouts[0]).toMatchObject({ amountCents: 7000, accountId: "acct_test_1" });

    await completeCheckout(deps, "test", checkout(), `pi_${checkout()}`);
    await completeCheckout(deps, "test", checkout(), `pi_${checkout()}`);
    expect(await statusOf(booking.id)).toBe("paid");
    await expect(startCheckout(deps, organizationId, booking.id, urls)).rejects.toThrow(
      "rien à payer",
    );

    await cancelBookingWithToken(deps, organizationId, manageToken);
    expect(await refundAfterCancellation(deps, organizationId, booking.id, "customer")).toBe(7000);
    expect(calls.refunds).toEqual([
      { accountId: "acct_test_1", paymentReference: `pi_${checkout()}`, amountCents: 7000 },
    ]);
    expect(await statusOf(booking.id)).toBe("refunded");
  });

  it("ne demande que l'acompte, et laisse l'équipe rembourser en partie", async () => {
    const event = await paidEvent("deposit");
    const { booking } = await createEventBooking(deps, customerActor(organizationId), {
      eventId: event.id,
      seats: 1,
      customer: contact(),
    });
    await startCheckout(deps, organizationId, booking.id, urls);
    expect(calls.checkouts[0]?.amountCents).toBe(1050);
    await completeCheckout(deps, "test", checkout(), `pi_${checkout()}`);

    await expect(
      refundBooking(deps, member(organizationId, "editor"), booking.id, 500),
    ).rejects.toThrow(ForbiddenError);
    expect(await refundBooking(deps, owner, booking.id, 500)).toBe(500);
    expect(await statusOf(booking.id)).toBe("partially_refunded");
    expect(await refundBooking(deps, owner, booking.id, 5000)).toBe(550);
    expect(await statusOf(booking.id)).toBe("refunded");
  });

  it("annule une réservation jamais payée et rend ses places", async () => {
    const event = await paidEvent("online", 1);
    const { booking } = await createEventBooking(deps, customerActor(organizationId), {
      eventId: event.id,
      seats: 1,
      customer: contact(),
    });
    await startCheckout(deps, organizationId, booking.id, urls);
    await expireCheckout(deps, "test", checkout());
    const [row] = await db.select().from(bookingTable).where(eq(bookingTable.id, booking.id));
    expect(row?.status).toBe("cancelled");
    const [attempt] = await db.select().from(payment).where(eq(payment.bookingId, booking.id));
    expect(attempt?.status).toBe("failed");
    // La place libérée se reprend aussitôt.
    const again = await createEventBooking(deps, customerActor(organizationId), {
      eventId: event.id,
      seats: 1,
      customer: contact("lea@mail.com"),
    });
    expect(again.booking.status).toBe("confirmed");
  });

  it("remplace une page de paiement abandonnée par la suivante", async () => {
    const event = await paidEvent("online", 1);
    const { booking } = await createEventBooking(deps, customerActor(organizationId), {
      eventId: event.id,
      seats: 1,
      customer: contact(),
    });
    await startCheckout(deps, organizationId, booking.id, urls);
    await startCheckout(deps, organizationId, booking.id, urls);
    await expireCheckout(deps, "test", checkout(1));
    const [row] = await db.select().from(bookingTable).where(eq(bookingTable.id, booking.id));
    expect(row?.status).toBe("cancelled");
  });

  it("refuse le paiement en ligne sans compte actif", async () => {
    await repositoriesFor(db).settings.setPaymentAccount(organizationId, "acct_test_1", "pending");
    const event = await paidEvent("online");
    const { booking } = await createEventBooking(deps, customerActor(organizationId), {
      eventId: event.id,
      seats: 1,
      customer: contact(),
    });
    await expect(startCheckout(deps, organizationId, booking.id, urls)).rejects.toThrow(
      "pas encore disponible",
    );
  });
});

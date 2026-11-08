import {
  type Actor,
  ConflictError,
  cancelBookingAsCustomer,
  createEvent,
  createEventBooking,
  createEventType,
  customerAccountForSession,
  type Deps,
  deleteCustomerAccount,
  NotFoundError,
  publishEvent,
  requestCustomerLoginLink,
  rescheduleBookingAsCustomer,
  signInWithLoginLink,
  signOutCustomer,
  updateCustomerProfile,
} from "@horaya/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  getAccountBooking,
  getCustomerDetail,
  listAccountBookings,
  listRescheduleCandidates,
} from "../src/queries";
import { booking, customer } from "../src/schema";
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

let clock: ReturnType<typeof fixedClock>;
let deps: Deps;
let organizationId: string;
let owner: Actor;

beforeEach(async () => {
  clock = fixedClock();
  deps = testDeps(clock);
  organizationId = await createOrganization();
  owner = member(organizationId);
});

/** Adresse unique par test : les comptes clients sont communs à tous les espaces. */
const uniqueEmail = () => `camille.${Math.random().toString(36).slice(2, 9)}@mail.com`;

async function signIn(email: string, organization: string | null = organizationId) {
  const { token } = await requestCustomerLoginLink(deps, { email, organizationId: organization });
  return signInWithLoginLink(deps, token);
}

async function stageType(waitlist = false) {
  return createEventType(deps, owner, {
    name: `Stage ${Math.random().toString(36).slice(2, 7)}`,
    color: "#B4532A",
    modules: waitlist ? { waitlist: {} } : {},
  });
}

async function stage(
  typeId: string,
  startsAt: string,
  options: { capacity?: number; priceCents?: number } = {},
) {
  const [created] = await createEvent(deps, owner, {
    eventTypeId: typeId,
    title: "Stage émaillage",
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 7 * 3_600_000).toISOString(),
    timezone: "Europe/Paris",
    capacity: options.capacity ?? 4,
    priceCents: options.priceCents ?? 8500,
    paymentMode: "on_site",
  });
  if (!created) throw new Error("Événement non créé");
  return publishEvent(deps, owner, created.id);
}

const book = (eventId: string, email: string, seats = 1) =>
  createEventBooking(deps, customerActor(organizationId), {
    eventId,
    seats,
    customer: contact(email),
  });

describe("connexion par lien magique", () => {
  it("crée l'espace au premier lien et y rattache les réservations faites avec cet e-mail", async () => {
    const email = uniqueEmail();
    const type = await stageType();
    const first = await stage(type.id, "2026-11-22T09:00:00Z");
    await book(first.id, email.toUpperCase());

    const { account, created, sessionToken } = await signIn(email);
    expect(created).toBe(true);
    expect(account).toMatchObject({ email, firstName: "Camille", lastName: "Roux" });
    expect(await customerAccountForSession(deps, sessionToken)).toMatchObject({ id: account.id });

    // Une réservation faite après la création s'y rattache aussi, et le deuxième lien ne recrée rien.
    await book((await stage(type.id, "2026-12-13T09:00:00Z")).id, email);
    expect(await listAccountBookings(db, email, organizationId)).toHaveLength(2);
    expect((await signIn(email)).created).toBe(false);
  });

  it("refuse un lien déjà utilisé, expiré ou inconnu", async () => {
    const email = uniqueEmail();
    const { token } = await requestCustomerLoginLink(deps, { email, organizationId });
    await signInWithLoginLink(deps, token);
    await expect(signInWithLoginLink(deps, token)).rejects.toBeInstanceOf(ConflictError);

    const late = await requestCustomerLoginLink(deps, { email, organizationId });
    clock.set(new Date(clock.now().getTime() + 15 * 60_000));
    await expect(signInWithLoginLink(deps, late.token)).rejects.toBeInstanceOf(ConflictError);
    await expect(signInWithLoginLink(deps, "inconnu")).rejects.toBeInstanceOf(ConflictError);
  });

  it("ferme la session à la déconnexion et après 30 jours", async () => {
    const email = uniqueEmail();
    const first = await signIn(email);
    await signOutCustomer(deps, first.sessionToken);
    expect(await customerAccountForSession(deps, first.sessionToken)).toBeNull();

    const second = await signIn(email);
    clock.set(new Date(clock.now().getTime() + 31 * 86_400_000));
    expect(await customerAccountForSession(deps, second.sessionToken)).toBeNull();
  });
});

describe("isolation entre espaces", () => {
  it("ne montre dans un espace que ses réservations, et toutes dans la vue horaya.app", async () => {
    const email = uniqueEmail();
    const mine = await book(
      (await stage((await stageType()).id, "2026-11-22T09:00:00Z")).id,
      email,
    );

    const otherId = await createOrganization("FIL");
    const otherOwner = member(otherId);
    const otherType = await createEventType(deps, otherOwner, {
      name: "Couture",
      color: "#3D6E8F",
    });
    const [otherEvent] = await createEvent(deps, otherOwner, {
      eventTypeId: otherType.id,
      title: "Atelier couture",
      startsAt: "2026-11-20T18:00:00Z",
      endsAt: "2026-11-20T20:30:00Z",
      timezone: "Europe/Paris",
      capacity: 6,
    });
    if (!otherEvent) throw new Error("Événement non créé");
    await publishEvent(deps, otherOwner, otherEvent.id);
    const theirs = await createEventBooking(deps, customerActor(otherId), {
      eventId: otherEvent.id,
      seats: 1,
      customer: contact(email),
    });

    const here = await listAccountBookings(db, email, organizationId);
    expect(here.map((row) => row.id)).toEqual([mine.booking.id]);
    const everywhere = await listAccountBookings(db, email, null);
    expect(everywhere.map((row) => row.workspace.name)).toHaveLength(2);

    // Une réservation d'un autre espace n'existe pas ici, même avec le bon e-mail.
    expect(await getAccountBooking(db, organizationId, theirs.booking.id, email)).toBeNull();
    expect(
      await getAccountBooking(db, organizationId, mine.booking.id, "autre@mail.com"),
    ).toBeNull();
    await expect(
      cancelBookingAsCustomer(deps, organizationId, theirs.booking.id, email),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      cancelBookingAsCustomer(deps, organizationId, mine.booking.id, "autre@mail.com"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("changer de date", () => {
  it("passe sur une autre date du même type, libère la place et fait monter la liste d'attente", async () => {
    const email = uniqueEmail();
    const type = await stageType(true);
    const current = await stage(type.id, "2026-11-22T09:00:00Z", { capacity: 1 });
    const next = await stage(type.id, "2026-12-13T09:00:00Z");
    const mine = await book(current.id, email);
    const waiting = await book(current.id, uniqueEmail());
    expect(waiting.booking.status).toBe("waitlisted");

    const candidates = await listRescheduleCandidates(
      db,
      organizationId,
      { eventId: current.id, eventTypeId: type.id },
      clock.now(),
    );
    expect(candidates.map((row) => row.id)).toEqual([next.id]);

    const moved = await rescheduleBookingAsCustomer(
      deps,
      organizationId,
      mine.booking.id,
      email,
      next.id,
    );
    expect(moved).toMatchObject({ eventId: next.id, status: "confirmed" });
    const [promoted] = await db.select().from(booking).where(eq(booking.id, waiting.booking.id));
    expect(promoted?.status).toBe("confirmed");
  });

  it("refuse un autre type, une date complète ou un délai dépassé", async () => {
    const email = uniqueEmail();
    const type = await stageType();
    const current = await stage(type.id, "2026-11-22T09:00:00Z");
    const mine = await book(current.id, email, 2);
    const move = (eventId: string) =>
      rescheduleBookingAsCustomer(deps, organizationId, mine.booking.id, email, eventId);

    const otherType = await stage((await stageType()).id, "2026-12-13T09:00:00Z");
    await expect(move(otherType.id)).rejects.toThrow(/pas proposée/);
    const small = await stage(type.id, "2026-12-15T09:00:00Z", { capacity: 1 });
    await expect(move(small.id)).rejects.toThrow(/que 1 place/);

    const open = await stage(type.id, "2026-12-16T09:00:00Z");
    // Délai d'annulation gratuite par défaut : 72 h avant le 22 novembre à 9 h.
    clock.set(new Date("2026-11-19T09:00:00Z"));
    await expect(move(open.id)).rejects.toThrow(/délai/);
  });
});

describe("changer de date vers un autre prix", () => {
  it("plus cher : le prix suit la date ; moins cher : le prix baisse sans rien rembourser", async () => {
    const email = uniqueEmail();
    const type = await stageType();
    const current = await stage(type.id, "2026-11-22T09:00:00Z");
    const mine = await book(current.id, email, 2);
    const before = mine.booking.amountCents;
    const pricier = await stage(type.id, "2026-12-14T09:00:00Z", { priceCents: 9500 });
    const cheaper = await stage(type.id, "2026-12-15T09:00:00Z", { priceCents: 5000 });
    const move = (eventId: string) =>
      rescheduleBookingAsCustomer(deps, organizationId, mine.booking.id, email, eventId);

    expect(await move(pricier.id)).toMatchObject({ eventId: pricier.id, amountCents: 19000 });
    expect(before).not.toBe(19000);
    expect(await move(cheaper.id)).toMatchObject({ eventId: cheaper.id, amountCents: 10000 });
  });
});

describe("profil et suppression", () => {
  it("met à jour la fiche de l'espace courant, puis supprime l'espace sans toucher aux réservations", async () => {
    const email = uniqueEmail();
    const mine = await book(
      (await stage((await stageType()).id, "2026-11-22T09:00:00Z")).id,
      email,
    );
    const { account, sessionToken } = await signIn(email);

    await updateCustomerProfile(
      deps,
      account,
      { firstName: "Camille", lastName: "Martin", phone: "06 12 34 56 78" },
      organizationId,
    );
    const [fiche] = await db
      .select()
      .from(customer)
      .where(eq(customer.id, mine.booking.customerId));
    expect(fiche).toMatchObject({ lastName: "Martin", phone: "06 12 34 56 78" });
    const detail = await getCustomerDetail(
      db,
      organizationId,
      mine.booking.customerId,
      clock.now(),
    );
    expect(detail?.customer.hasAccount).toBe(true);

    await deleteCustomerAccount(deps, account);
    expect(await customerAccountForSession(deps, sessionToken)).toBeNull();
    const after = await getCustomerDetail(db, organizationId, mine.booking.customerId, clock.now());
    expect(after?.customer.hasAccount).toBe(false);
    expect(await listAccountBookings(db, email, organizationId)).toHaveLength(1);
  });
});

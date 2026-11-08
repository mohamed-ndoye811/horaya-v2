import {
  ConflictError,
  cancelBooking,
  createEvent,
  createEventBooking,
  createEventType,
  createItem,
  type Deps,
  type EquipmentNeed,
  type EventModules,
  publishEvent,
  updateEvent,
  ValidationError,
} from "@horaya/core";
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  getBookingDetail,
  getPublicEvent,
  listBookingEquipment,
  listEquipmentOffers,
  listEvents,
  listNotificationRecipients,
} from "../src/queries";
import {
  event as eventTable,
  itemAllocation,
  itemUnit,
  notificationPreference,
  tenantSettings,
} from "../src/schema";
import {
  contact,
  createMember,
  createOrganization,
  customerActor,
  db,
  fixedClock,
  testDeps,
} from "./helpers";

afterAll(() => db.$client.end());

let organizationId: string;
let owner: Awaited<ReturnType<typeof createMember>>;
let deps: Deps;
let toursType: string;
let apronsType: string;
let tourUnits: string[];

const unitsOf = async (itemId: string) =>
  (
    await db
      .select({ id: itemUnit.id })
      .from(itemUnit)
      .where(eq(itemUnit.itemId, itemId))
      .orderBy(itemUnit.label)
  ).map((row) => row.id);

beforeEach(async () => {
  organizationId = await createOrganization();
  owner = await createMember(organizationId);
  deps = testDeps(fixedClock());
  const tours = await createItem(deps, owner, {
    name: "Tour Shimpo",
    typeName: "Tours",
    quantity: 3,
  });
  const aprons = await createItem(deps, owner, {
    name: "Tablier",
    typeName: "Tabliers",
    quantity: 2,
  });
  toursType = tours.itemTypeId as string;
  apronsType = aprons.itemTypeId as string;
  tourUnits = await unitsOf(tours.id);
  apronUnits = await unitsOf(aprons.id);
});
let apronUnits: string[];

const tour: EquipmentNeed = {
  id: "tour",
  itemTypeId: "",
  perSeat: 1,
  required: true,
  chooser: "workshop",
};

async function lesson(
  modules: (types: { tours: string; aprons: string }) => EventModules,
  extra = {},
) {
  const type = await createEventType(deps, owner, {
    name: `Cours ${Math.random()}`,
    color: "#528D74",
    modules: modules({ tours: toursType, aprons: apronsType }),
  });
  const [created] = await createEvent(deps, owner, {
    eventTypeId: type.id,
    title: "Cours de tournage",
    startsAt: "2026-11-20T18:00:00Z",
    endsAt: "2026-11-20T20:00:00Z",
    timezone: "Europe/Paris",
    ...extra,
  });
  if (!created) throw new Error("événement");
  return publishEvent(deps, owner, created.id);
}

const book = (
  eventId: string,
  seats = 1,
  equipment: Array<Record<string, unknown>> = [],
  email?: string,
) =>
  createEventBooking(deps, customerActor(organizationId), {
    eventId,
    seats,
    customer: contact(email),
    equipment: equipment as never,
  });

const active = (bookingId: string) =>
  db
    .select()
    .from(itemAllocation)
    .where(and(eq(itemAllocation.bookingId, bookingId), isNull(itemAllocation.cancelledAt)));

describe("matériel avancé", () => {
  it("obligatoire attribué par l'atelier : une unité par place, jamais deux fois", async () => {
    const lessonEvent = await lesson(({ tours }) => ({
      equipment: { needs: [{ ...tour, itemTypeId: tours }] },
    }));
    const first = await book(lessonEvent.id, 2, [], "a@mail.com");
    const held = await active(first.booking.id);
    expect(held).toHaveLength(2);
    expect(held.every((entry) => entry.needId === "tour" && entry.eventId === lessonEvent.id)).toBe(
      true,
    );
    expect(await listBookingEquipment(db, first.booking.id)).toHaveLength(2);
    expect((await getBookingDetail(db, organizationId, first.booking.id))?.equipment).toHaveLength(
      2,
    );

    // Il ne reste qu'un tour : 2 places refusées, et rien n'est écrit (pas même la réservation).
    await expect(book(lessonEvent.id, 2, [], "b@mail.com")).rejects.toThrow(ConflictError);
    const last = await book(lessonEvent.id, 1, [], "c@mail.com");
    const taken = [...held, ...(await active(last.booking.id))].map((entry) => entry.itemUnitId);
    expect(new Set(taken).size).toBe(3);
    await expect(book(lessonEvent.id, 1, [], "d@mail.com")).rejects.toThrow("Plus de tour");
  });

  it("l'annulation libère le matériel", async () => {
    const lessonEvent = await lesson(({ tours }) => ({
      equipment: { needs: [{ ...tour, itemTypeId: tours, perSeat: 3 }] },
    }));
    const { booking } = await book(lessonEvent.id, 1);
    await expect(book(lessonEvent.id, 1, [], "autre@mail.com")).rejects.toThrow(ConflictError);
    await cancelBooking(deps, owner, booking.id);
    expect(await active(booking.id)).toHaveLength(0);
    await expect(book(lessonEvent.id, 1, [], "autre@mail.com")).resolves.toBeDefined();
  });

  it("facultatif : seulement si la case est cochée ; l'élève choisit l'exemplaire", async () => {
    const lessonEvent = await lesson(({ aprons }) => ({
      equipment: {
        needs: [
          { ...tour, id: "tablier", itemTypeId: aprons, required: false, chooser: "student" },
        ],
      },
    }));
    const without = await book(
      lessonEvent.id,
      1,
      [{ needId: "tablier", wanted: false }],
      "a@mail.com",
    );
    expect(await active(without.booking.id)).toHaveLength(0);

    // Coché sans désigner d'exemplaire : refus.
    await expect(
      book(lessonEvent.id, 1, [{ needId: "tablier", wanted: true }], "b@mail.com"),
    ).rejects.toThrow(ValidationError);
    const chosen = apronUnits[1] as string;
    const wants = await book(
      lessonEvent.id,
      1,
      [{ needId: "tablier", wanted: true, unitIds: [chosen] }],
      "b@mail.com",
    );
    expect((await active(wants.booking.id)).map((entry) => entry.itemUnitId)).toEqual([chosen]);

    // L'exemplaire pris n'est plus proposé, et ne peut pas être choisi une seconde fois.
    const [offer] = await listEquipmentOffers(db, lessonEvent.id);
    expect(offer?.options.map((option) => option.unitId)).toEqual([apronUnits[0]]);
    await expect(
      book(
        lessonEvent.id,
        1,
        [{ needId: "tablier", wanted: true, unitIds: [chosen] }],
        "c@mail.com",
      ),
    ).rejects.toThrow(ConflictError);
  });

  it("une unité en maintenance ou hors de la restriction de l'événement n'est pas proposée", async () => {
    const lessonEvent = await lesson(({ tours }) => ({
      equipment: { needs: [{ ...tour, itemTypeId: tours, chooser: "student" }] },
    }));
    const restricted = await updateEvent(deps, owner, lessonEvent.id, {
      equipmentUnits: { tour: [tourUnits[0] as string, tourUnits[1] as string] },
    });
    expect(restricted.modules.equipment?.needs[0]?.unitIds).toEqual([tourUnits[0], tourUnits[1]]);
    const [offer] = await listEquipmentOffers(db, lessonEvent.id);
    expect(offer?.available).toBe(2);
    await expect(
      book(lessonEvent.id, 1, [{ needId: "tour", unitIds: [tourUnits[2] as string] }]),
    ).rejects.toThrow(ConflictError);
    // Retirer l'exemplaire du service le retire de l'offre.
    await db
      .update(itemUnit)
      .set({ status: "maintenance" })
      .where(eq(itemUnit.id, tourUnits[0] as string));
    const [after] = await listEquipmentOffers(db, lessonEvent.id);
    expect(after?.options.map((option) => option.unitId)).toEqual([tourUnits[1]]);
  });

  it("le type refuse un type de matériel inconnu", async () => {
    await expect(
      createEventType(deps, owner, {
        name: "Mauvais",
        color: "#528D74",
        modules: {
          equipment: { needs: [{ ...tour, itemTypeId: "11111111-1111-4111-8111-111111111111" }] },
        },
      }),
    ).rejects.toThrow(ValidationError);
  });
});

describe("lieu", () => {
  it("à l'atelier : l'adresse de l'espace ; en ligne : le lien, jamais public", async () => {
    await db
      .update(tenantSettings)
      .set({ address: "12 rue des Potiers" })
      .where(eq(tenantSettings.organizationId, organizationId));
    const venue = await lesson(() => ({ location: { mode: "venue" } }));
    expect(venue.locationAddress).toBe("12 rue des Potiers");

    const online = await lesson(() => ({
      location: { mode: "online", onlineUrl: "https://meet.example/secret" },
    }));
    expect(online.onlineUrl).toBe("https://meet.example/secret");
    const publicRow = await getPublicEvent(db, organizationId, online.slug);
    expect(publicRow?.online).toBe(true);
    expect(JSON.stringify(publicRow)).not.toContain("secret");
  });

  it("chez le client : l'adresse est demandée à l'inscription", async () => {
    const home = await lesson(() => ({ location: { mode: "client" } }));
    expect(home.fields.some((field) => field.key === "adresse_client")).toBe(true);
    await expect(book(home.id)).rejects.toThrow(ValidationError);
    const ok = await createEventBooking(deps, customerActor(organizationId), {
      eventId: home.id,
      seats: 1,
      customer: contact(),
      answers: { adresse_client: "5 rue Neuve, Lyon" },
    });
    expect(ok.booking.answers).toMatchObject({ adresse_client: "5 rue Neuve, Lyon" });
  });
});

describe("intervenant", () => {
  it("choisi sur chaque événement parmi les membres proposés, affiché et filtrable", async () => {
    const teacher = await createMember(organizationId, "editor");
    const other = await createMember(organizationId, "editor");
    const memberId = (teacher as { memberId: string }).memberId;
    const type = await createEventType(deps, owner, {
      name: "Avec intervenant",
      color: "#528D74",
      modules: { staff: { memberIds: [memberId], showOnPublicPage: true } },
    });
    const input = {
      eventTypeId: type.id,
      title: "Cours",
      startsAt: "2026-11-21T18:00:00Z",
      endsAt: "2026-11-21T20:00:00Z",
      timezone: "Europe/Paris",
    };
    await expect(
      createEvent(deps, owner, {
        ...input,
        staffMemberId: (other as { memberId: string }).memberId,
      }),
    ).rejects.toThrow(ValidationError);
    const [created] = await createEvent(deps, owner, { ...input, staffMemberId: memberId });
    await createEvent(deps, owner, { ...input, title: "Sans intervenant" });
    if (!created) throw new Error("événement");
    expect(
      (await db.select().from(eventTable).where(eq(eventTable.id, created.id)))[0]?.staffMemberId,
    ).toBe(memberId);

    const mine = await listEvents(db, organizationId, {
      tab: "all",
      now: new Date("2026-10-01"),
      staffMemberId: memberId,
    });
    expect(mine.map((row) => row.id)).toEqual([created.id]);
    expect(mine[0]?.staffName).toBe("Mohamed Ndoye");

    // L'intervenant reçoit les inscriptions de ses événements, même s'il a coupé cette notification.
    await db.insert(notificationPreference).values({
      organizationId,
      memberId,
      notificationType: "booking_created",
      email: false,
      inApp: false,
    });
    const without = await listNotificationRecipients(db, organizationId, "booking_created");
    const withStaff = await listNotificationRecipients(
      db,
      organizationId,
      "booking_created",
      memberId,
    );
    expect(withStaff.length).toBe(without.length + 1);

    await publishEvent(deps, owner, created.id);
    expect((await getPublicEvent(db, organizationId, created.slug))?.staffFirstName).toBe(
      "Mohamed",
    );
  });
});

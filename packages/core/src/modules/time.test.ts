import { describe, expect, it } from "vitest";
import { quoteBooking, selectionFor, selectionFromLines } from "../bookings/pricing";
import { ValidationError } from "../shared/errors";
import type { DurationModule, EventModules, SlotsModule } from "./registry";
import { slotsModuleSchema } from "./registry";
import {
  dayMoment,
  durationLabel,
  durationOf,
  durationTitle,
  generateSlots,
  nextWeekSlotCount,
  pickSlotOption,
  type SlotInput,
  slotMinutes,
  type TakenSlot,
  withChosenDuration,
} from "./time";

const TZ = "Europe/Paris";
const closed: SlotsModule["weekly"] = [[], [], [], [], [], [], []];
/** Mardi 14:00–18:00 seulement. */
const tuesday = (extra: Partial<SlotsModule> = {}): SlotsModule => ({
  weekly: closed.map((ranges, day) => (day === 1 ? [{ start: "14:00", end: "18:00" }] : ranges)),
  intervalMinutes: 30,
  ...extra,
});
// Mardi 10 novembre 2026 (heure d'hiver : Paris = UTC+1).
const TUESDAY = { year: 2026, month: 11, day: 10 };
const paris = (iso: string) => new Date(`${iso}+01:00`);
const hours = (list: ReadonlyArray<{ startsAt: Date }>) =>
  list.map((slot) =>
    new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(
      slot.startsAt,
    ),
  );
const run = (input: Partial<SlotInput> & { slots: SlotsModule }) =>
  generateSlots({
    durationMinutes: 60,
    timeZone: TZ,
    from: TUESDAY,
    days: 1,
    now: paris("2026-11-01T09:00:00"),
    taken: [],
    ...input,
  });
const taken = (start: string, end: string, extra: Partial<TakenSlot> = {}): TakenSlot => ({
  startsAt: paris(`2026-11-10T${start}:00`),
  endsAt: paris(`2026-11-10T${end}:00`),
  staffMemberId: null,
  eventId: "e1",
  seatsHeld: 1,
  capacity: 1,
  ...extra,
});

describe("créneaux : génération à la volée", () => {
  it("découpe chaque plage au rythme choisi, le dernier départ tient dans la plage", () => {
    const slots = run({ slots: tuesday() });
    expect(hours(slots)).toEqual(["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]);
    expect(slots[0]?.endsAt.toISOString()).toBe("2026-11-10T14:00:00.000Z");
    expect(slots[0]?.options).toEqual([{ staffMemberId: null, eventId: null, seatsLeft: 1 }]);
  });

  it("la durée choisie change les départs possibles", () => {
    expect(hours(run({ slots: tuesday(), durationMinutes: 120 }))).toEqual([
      "14:00",
      "14:30",
      "15:00",
      "15:30",
      "16:00",
    ]);
    expect(run({ slots: tuesday(), durationMinutes: 300 })).toEqual([]);
  });

  it("plusieurs plages dans la journée, jours fermés ignorés", () => {
    const slots = tuesday();
    slots.weekly[1] = [
      { start: "10:00", end: "11:00" },
      { start: "18:30", end: "20:30" },
    ];
    expect(hours(run({ slots, days: 7, from: { year: 2026, month: 11, day: 9 } }))).toEqual([
      "10:00",
      "18:30",
      "19:00",
      "19:30",
    ]);
  });

  it("une fermeture datée retire les jours qu'elle couvre, bornes comprises", () => {
    const slots = tuesday({ closures: [{ from: "2026-11-10", to: "2026-11-10", label: "salon" }] });
    expect(run({ slots })).toEqual([]);
    expect(run({ slots, from: { year: 2026, month: 11, day: 17 } })).toHaveLength(7);
  });

  it("un créneau pris bloque son moment, pause comprise, et l'on repart juste après", () => {
    const slots = run({
      slots: tuesday({ breakMinutes: 15 }),
      taken: [taken("15:00", "16:00")],
    });
    // 14:00 finit à 15:00 : sans pause avant l'élève suivant, il n'est pas proposé.
    expect(hours(slots)).toEqual(["16:15", "16:30", "17:00"]);
  });

  it("une réservation provisoire (sans événement) bloque comme un créneau pris", () => {
    const slots = run({ slots: tuesday(), taken: [taken("14:00", "15:00", { eventId: null })] });
    expect(hours(slots)).toEqual(["15:00", "15:30", "16:00", "16:30", "17:00"]);
  });

  it("respecte la fenêtre de réservation : au plus tard X h avant, au plus tôt J-N", () => {
    const now = paris("2026-11-09T15:30:00");
    const window = tuesday({ closesHoursBefore: 24 });
    expect(hours(run({ slots: window, now }))).toEqual(["15:30", "16:00", "16:30", "17:00"]);
    const far = tuesday({ opensDaysBefore: 7 });
    expect(run({ slots: far, now: paris("2026-11-02T13:00:00") })).toHaveLength(0);
    expect(run({ slots: far, now: paris("2026-11-03T18:00:00") })).toHaveLength(7);
    // Jamais dans le passé.
    expect(hours(run({ slots: tuesday(), now: paris("2026-11-10T16:10:00") }))).toEqual([
      "16:30",
      "17:00",
    ]);
  });

  it("garde l'heure murale aux changements d'heure", () => {
    const sundays = closed.map((ranges, day) =>
      day === 6 ? [{ start: "10:00", end: "11:00" }] : ranges,
    );
    const slots = generateSlots({
      slots: { weekly: sundays, intervalMinutes: 60 },
      durationMinutes: 60,
      timeZone: TZ,
      from: { year: 2026, month: 10, day: 18 },
      days: 14,
      now: new Date("2026-10-01T00:00:00Z"),
      taken: [],
    });
    // 18 octobre : heure d'été (UTC+2) ; 25 octobre : passage à l'heure d'hiver (UTC+1).
    expect(slots.map((slot) => slot.startsAt.toISOString())).toEqual([
      "2026-10-18T08:00:00.000Z",
      "2026-10-25T09:00:00.000Z",
    ]);
  });

  it("intervenants : un créneau est proposé avec ceux qui sont libres", () => {
    const slots = run({
      slots: tuesday({ memberIds: ["a", "b"] }),
      taken: [taken("14:00", "15:00", { staffMemberId: "a" })],
      staffBusy: { b: [{ startsAt: paris("2026-11-10T15:00:00"), endsAt: paris("2026-11-10T16:00:00") }] },
    });
    const at = (hour: string) =>
      slots[hours(slots).indexOf(hour)]?.options.map((option) => option.staffMemberId);
    expect(at("14:00")).toEqual(["b"]);
    expect(at("15:00")).toEqual(["a"]);
    expect(at("16:00")).toEqual(["a", "b"]);
    expect(hours(slots)).not.toContain("14:30");
  });

  it("créneau à plusieurs places : on complète l'existant tant qu'il reste de la place", () => {
    const slots = run({
      slots: tuesday({ seatsPerSlot: 4 }),
      taken: [taken("14:00", "15:00", { seatsHeld: 2, capacity: 4 })],
    });
    expect(slots[0]?.options).toEqual([{ staffMemberId: null, eventId: "e1", seatsLeft: 2 }]);
    expect(hours(slots)).toEqual(["14:00", "15:00", "15:30", "16:00", "16:30", "17:00"]);
    expect(pickSlotOption(slots[0], null, 3)).toBeNull();
    expect(pickSlotOption(slots[0], null, 2)?.eventId).toBe("e1");
    const full = run({
      slots: tuesday({ seatsPerSlot: 4 }),
      taken: [taken("14:00", "15:00", { seatsHeld: 4, capacity: 4 })],
    });
    expect(hours(full)[0]).toBe("15:00");
  });

  it("« Peu importe » complète d'abord un créneau, sinon prend le premier intervenant libre", () => {
    const slot = {
      startsAt: new Date(),
      endsAt: new Date(),
      options: [
        { staffMemberId: "a", eventId: null, seatsLeft: 1 },
        { staffMemberId: "b", eventId: "e2", seatsLeft: 1 },
      ],
    };
    expect(pickSlotOption(slot, null, 1)?.staffMemberId).toBe("b");
    expect(pickSlotOption(slot, "a", 1)?.eventId).toBeNull();
    expect(pickSlotOption(slot, "c", 1)).toBeNull();
    expect(pickSlotOption(undefined, null, 1)).toBeNull();
  });

  it("matériel obligatoire : il faut assez d'exemplaires libres sur le créneau", () => {
    const busy = [{ startsAt: paris("2026-11-10T14:00:00"), endsAt: paris("2026-11-10T15:00:00") }];
    const oneLeft = run({ slots: tuesday(), equipment: [{ quantity: 1, units: [busy, []] }] });
    expect(hours(oneLeft)).toContain("14:00");
    const none = run({ slots: tuesday(), equipment: [{ quantity: 1, units: [busy, busy] }] });
    expect(hours(none)).toEqual(["15:00", "15:30", "16:00", "16:30", "17:00"]);
    const two = run({ slots: tuesday(), equipment: [{ quantity: 2, units: [busy, []] }] });
    expect(hours(two)[0]).toBe("15:00");
  });

  it("regroupe les heures par moment de la journée", () => {
    expect(dayMoment(paris("2026-11-10T09:30:00"), TZ)).toBe("Matin");
    expect(dayMoment(paris("2026-11-10T16:15:00"), TZ)).toBe("Après-midi");
    expect(dayMoment(paris("2026-11-10T16:45:00"), TZ)).toBe("Fin d'après-midi");
    expect(dayMoment(paris("2026-11-10T18:30:00"), TZ)).toBe("Soir");
  });

  it("compte les créneaux de la semaine suivante (pastille de l'éditeur)", () => {
    const slots = slotsModuleSchema.parse({
      weekly: [
        [],
        [{ start: "14:00", end: "18:00" }],
        [],
        [
          { start: "14:00", end: "18:00" },
          { start: "18:30", end: "20:30" },
        ],
        [],
        [{ start: "10:00", end: "13:00" }],
        [],
      ],
      intervalMinutes: 30,
    });
    // 7 + (7 + 3) + 5 départs d'une heure.
    expect(nextWeekSlotCount(slots, 60, TZ, paris("2026-11-04T10:00:00"))).toBe(22);
  });

  it("refuse des plages qui se chevauchent ou à l'envers", () => {
    const overlap = tuesday();
    overlap.weekly[1] = [
      { start: "14:00", end: "16:00" },
      { start: "15:00", end: "17:00" },
    ];
    expect(slotsModuleSchema.safeParse(overlap).success).toBe(false);
    const reversed = tuesday();
    reversed.weekly[1] = [{ start: "16:00", end: "14:00" }];
    expect(slotsModuleSchema.safeParse(reversed).success).toBe(false);
  });
});

const durations: DurationModule = {
  options: [
    { id: "1h", label: "1 h", minutes: 60, priceCents: 4500, description: "Découverte" },
    { id: "2h", label: "2 h", minutes: 120, priceCents: 8000 },
    { id: "journee", label: "Journée", minutes: 360, priceCents: 18000 },
  ],
  defaultId: "1h",
};

describe("durée au choix", () => {
  it("nomme les durées", () => {
    expect(durationLabel(45)).toBe("45 min");
    expect(durationLabel(60)).toBe("1 h");
    expect(durationLabel(90)).toBe("1 h 30");
    expect(durationTitle(durations.options[0] as never)).toBe("1 h");
    expect(durationTitle(durations.options[2] as never)).toBe("Journée · 6 h");
  });

  it("choisit la durée demandée, sinon celle par défaut ; refuse une durée inconnue", () => {
    expect(durationOf(durations).id).toBe("1h");
    expect(durationOf({ options: durations.options }).id).toBe("1h");
    expect(durationOf(durations, "journee").minutes).toBe(360);
    expect(() => durationOf(durations, "3h")).toThrow(ValidationError);
    expect(slotMinutes({ duration: durations }, 90, "2h")).toBe(120);
    expect(slotMinutes({}, 90)).toBe(90);
    expect(slotMinutes({}, null)).toBe(60);
  });

  const event = (modules: EventModules) => ({
    priceCents: 4500,
    paymentMode: "on_site" as const,
    modules,
  });

  it("la durée fixe le prix de chaque place", () => {
    const quote = quoteBooking(event({ duration: durations }), 2, { durationId: "2h" });
    expect(quote.amountCents).toBe(16000);
    expect(quote.lines).toEqual([
      { kind: "duration", id: "2h", label: "2 h", unitCents: 8000, quantity: 2, totalCents: 16000 },
    ]);
    expect(quoteBooking(event({ duration: durations }), 1).amountCents).toBe(4500);
    expect(() => quoteBooking(event({ duration: durations }), 1, { durationId: "x" })).toThrow(
      ValidationError,
    );
  });

  it("avec « Tarifs et options » : la durée remplace les tarifs, les options s'ajoutent", () => {
    const modules: EventModules = {
      duration: durations,
      pricing: {
        rates: [
          { id: "plein", name: "Plein", priceCents: 9900 },
          { id: "reduit", name: "Réduit", priceCents: 100 },
        ],
        options: [{ id: "terre", name: "Terre", priceCents: 1500, per: "booking" }],
      },
    };
    const quote = quoteBooking(event(modules), 1, {
      durationId: "journee",
      rates: ["reduit"],
      options: { terre: 1 },
    });
    expect(quote.amountCents).toBe(19500);
    expect(quote.lines.map((line) => line.kind)).toEqual(["duration", "option"]);
    // Une réduction de règle s'applique au total.
    const reduced = quoteBooking(event(modules), 1, { durationId: "1h" }, [
      { kind: "percent", id: "r", label: "-10 %", percent: 10 },
    ]);
    expect(reduced.amountCents).toBe(4050);
  });

  it("un événement qui a pris sa durée ne propose qu'elle ; le choix se relit dans le détail", () => {
    const modules = withChosenDuration({ duration: durations }, durations.options[1] as never);
    expect(modules.duration?.options.map((option) => option.id)).toEqual(["2h"]);
    const quote = quoteBooking(event(modules), 1);
    expect(quote.amountCents).toBe(8000);
    const selection = selectionFromLines(quote.lines);
    expect(selection.durationId).toBe("2h");
    expect(selectionFor(event({ duration: durations }), 1, selection).durationId).toBe("2h");
    expect(selectionFor(event({}), 1, selection).durationId).toBeUndefined();
  });

  it("gratuit : rien à payer, quelle que soit la durée", () => {
    expect(
      quoteBooking({ ...event({ duration: durations }), paymentMode: "free" }, 1, {
        durationId: "journee",
      }).amountCents,
    ).toBe(0);
  });
});

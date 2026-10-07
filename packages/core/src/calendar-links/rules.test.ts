import { describe, expect, it } from "vitest";
import { calendarLinkAllows, randomSlugSuffix } from "./rules";
import { createCalendarLinkSchema } from "./schemas";

const TYPE = "0192f0a0-0000-7000-8000-000000000001";
const EVENT = "0192f0a0-0000-7000-8000-000000000002";
const event = { id: EVENT, eventTypeId: TYPE };

describe("calendarLinkAllows", () => {
  it("filtre par type, par événement, ou montre tout", () => {
    expect(calendarLinkAllows({ filterMode: "all", filterIds: [], isActive: true }, event)).toBe(
      true,
    );
    expect(
      calendarLinkAllows({ filterMode: "event_types", filterIds: [TYPE], isActive: true }, event),
    ).toBe(true);
    expect(
      calendarLinkAllows({ filterMode: "events", filterIds: [TYPE], isActive: true }, event),
    ).toBe(false);
  });

  it("ne montre rien quand le lien est désactivé", () => {
    expect(calendarLinkAllows({ filterMode: "all", filterIds: [], isActive: false }, event)).toBe(
      false,
    );
  });
});

describe("createCalendarLinkSchema", () => {
  it("exige au moins un élément, sauf pour « tous les événements »", () => {
    const result = createCalendarLinkSchema.safeParse({
      name: "Équipe Vidal",
      filterMode: "events",
      filterIds: [],
    });
    expect(result.error?.issues[0]).toMatchObject({
      path: ["filterIds"],
      message: "Choisis au moins un élément",
    });
    expect(
      createCalendarLinkSchema.parse({ name: "Tout", filterMode: "all", filterIds: [EVENT] }),
    ).toMatchObject({ filterIds: [] });
  });
});

describe("randomSlugSuffix", () => {
  it("donne 10 caractères sans ambiguïté (ni l, ni o, ni 0, ni 1)", () => {
    const suffix = randomSlugSuffix();
    expect(suffix).toMatch(/^[a-km-np-z2-9]{10}$/);
    expect(randomSlugSuffix()).not.toBe(suffix);
  });
});

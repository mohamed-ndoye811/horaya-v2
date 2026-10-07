import { z } from "zod";
import { CALENDAR_LINK_FILTERS } from "./model";

const name = z.string().trim().min(2, "2 caractères minimum").max(80, "80 caractères maximum");

const filterFields = {
  filterMode: z.enum(CALENDAR_LINK_FILTERS, { error: "Choisis ce que montre le lien" }),
  filterIds: z.array(z.uuid("Élément inconnu")).max(500, "500 éléments maximum"),
};

/** Au moins un type ou un événement, sauf pour « tous les événements ». */
const hasSelection = (value: { filterMode: string; filterIds: string[] }) =>
  value.filterMode === "all" || value.filterIds.length > 0;
const selectionIssue = { message: "Choisis au moins un élément", path: ["filterIds"] };
const normalized = <T extends { filterMode: string; filterIds: string[] }>(value: T): T => ({
  ...value,
  filterIds: value.filterMode === "all" ? [] : [...new Set(value.filterIds)],
});

export const calendarLinkFilterSchema = z
  .object(filterFields)
  .refine(hasSelection, selectionIssue)
  .transform(normalized);

export const createCalendarLinkSchema = z
  .object({ name, ...filterFields })
  .refine(hasSelection, selectionIssue)
  .transform(normalized);
export type CreateCalendarLinkInput = z.input<typeof createCalendarLinkSchema>;

/** Mise à jour partielle : nom, filtre (mode et éléments ensemble) ou activation. */
export const updateCalendarLinkSchema = z.object({
  name: name.optional(),
  filter: calendarLinkFilterSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateCalendarLinkInput = z.input<typeof updateCalendarLinkSchema>;

import { EVENT_TYPE_TEMPLATES } from "../events/templates";
import { createEvent, createEventType } from "../events/use-cases";
import { createItem, setEventItemQuantity } from "../inventory/use-cases";
import type { Actor } from "../shared/actor";
import { addDays, fromZonedParts, toZonedParts, weekdayOf } from "../shared/time";
import type { Deps } from "../shared/unit-of-work";
import type { TenantSector } from "./workspace";

interface Starter {
  /** Modèle de type d'événement (events/templates.ts) dont part l'exemple. */
  template: string;
  title: string;
  /** Matériel prêté pendant la séance, une unité par place. */
  item: string | null;
}

/** Séance exemple par secteur : de quoi voir tout le parcours avant d'écrire la sienne. */
export const STARTERS: Record<TenantSector, Starter> = {
  consulting: { template: "stage", title: "Atelier découverte", item: null },
  events: { template: "soiree", title: "Soirée de lancement", item: "Chaise pliante" },
  culture: { template: "cours-collectif", title: "Atelier découverte", item: "Kit de matériel" },
  wellness: { template: "cours-collectif", title: "Cours d'essai", item: "Équipement prêté" },
  education: { template: "cours-collectif", title: "Cours d'essai", item: null },
  hospitality: { template: "stage", title: "Sortie découverte", item: "Équipement prêté" },
  association: { template: "cours-collectif", title: "Activité découverte", item: null },
  other: { template: "cours-collectif", title: "Séance découverte", item: null },
};

/** Samedi suivant (au moins 2 jours plus tard) à 10 h, heure de l'espace. */
export function nextSaturdayMorning(now: Date, timeZone: string): Date {
  const today = toZonedParts(now, timeZone);
  const weekday = weekdayOf(today.year, today.month, today.day);
  let days = (5 - weekday + 7) % 7;
  if (days < 2) days += 7;
  return fromZonedParts({ ...addDays(today, days), hour: 10, minute: 0 }, timeZone);
}

/**
 * À la création d'un espace : un type tiré du modèle du secteur, une séance exemple en
 * brouillon et, selon le secteur, le matériel qu'elle prête. L'organisateur la modifie ou la
 * supprime ; rien n'est visible du public tant qu'il ne la publie pas.
 */
export async function createStarterContent(
  deps: Deps,
  actor: Actor,
  sector: TenantSector,
  timeZone: string,
) {
  const starter = STARTERS[sector];
  const template = EVENT_TYPE_TEMPLATES.find((entry) => entry.id === starter.template);
  if (!template) throw new Error(`Modèle inconnu : ${starter.template}`);
  const { id: _id, ...typeInput } = template;
  const type = await createEventType(deps, actor, typeInput);

  const minutes = template.defaultDurationMinutes ?? 90;
  const capacity = template.modules.places?.capacity ?? null;
  const priceCents = template.defaultPriceCents ?? 0;
  const startsAt = nextSaturdayMorning(deps.clock.now(), timeZone);
  const [event] = await createEvent(deps, actor, {
    eventTypeId: type.id,
    title: `${starter.title} (exemple)`,
    description:
      "Séance d'exemple préparée par Horaya : change le titre, la date, les places et le prix, puis publie-la. Tu peux aussi la supprimer.",
    startsAt,
    endsAt: new Date(startsAt.getTime() + minutes * 60_000),
    timezone: timeZone,
    capacity,
    priceCents,
    paymentMode: priceCents > 0 ? "on_site" : "free",
  });
  if (event && starter.item && capacity) {
    const item = await createItem(deps, actor, { name: starter.item, quantity: capacity });
    await setEventItemQuantity(deps, actor, {
      eventId: event.id,
      itemId: item.id,
      quantity: capacity,
    });
  }
  return { eventTypeId: type.id, eventId: event?.id ?? null };
}

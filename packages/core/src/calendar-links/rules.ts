import type { CalendarLink } from "./model";

/** Le lien montre-t-il cet événement ? (le statut publié se vérifie à part) */
export function calendarLinkAllows(
  link: Pick<CalendarLink, "filterMode" | "filterIds" | "isActive">,
  event: { id: string; eventTypeId: string },
): boolean {
  if (!link.isActive) return false;
  switch (link.filterMode) {
    case "all":
      return true;
    case "event_types":
      return link.filterIds.includes(event.eventTypeId);
    case "events":
      return link.filterIds.includes(event.id);
  }
}

/** Partie aléatoire de l'adresse d'un lien : 10 caractères, impossible à deviner. */
export function randomSlugSuffix(length = 10): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

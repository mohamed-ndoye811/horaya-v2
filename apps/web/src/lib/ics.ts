/** Fichiers iCalendar : événement réservé (« Ajouter à ton agenda », écran 19) et flux d'agenda des membres. */

const escapeText = (value: string) =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", ";")
    .replaceAll(",", "\\,")
    .replace(/\r?\n/g, "\\n");

/** Format UTC compact : 20260615T120000Z. */
export const icsDate = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

/** Lignes de 75 octets au plus (RFC 5545), suite précédée d'une espace. */
function fold(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    if (bytes.encode(current + char).length > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export interface IcsEvent {
  uid: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  /** Événement annulé : l'agenda abonné le retire ou le barre. */
  cancelled?: boolean;
}

const eventLines = (event: IcsEvent, now: Date) => [
  "BEGIN:VEVENT",
  `UID:${event.uid}`,
  `DTSTAMP:${icsDate(now)}`,
  `DTSTART:${icsDate(event.startsAt)}`,
  `DTEND:${icsDate(event.endsAt)}`,
  `SUMMARY:${escapeText(event.title)}`,
  ...(event.cancelled ? ["STATUS:CANCELLED"] : []),
  ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
  ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
  ...(event.url ? [`URL:${event.url}`] : []),
  "END:VEVENT",
];

/** Calendrier de plusieurs événements ; avec `name`, un flux d'abonnement (rafraîchi chaque heure). */
export function buildIcsCalendar(calendar: {
  organizer: string;
  name?: string;
  events: IcsEvent[];
  now?: Date;
}): string {
  const now = calendar.now ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Horaya//${escapeText(calendar.organizer)}//FR`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(calendar.name
      ? [
          `X-WR-CALNAME:${escapeText(calendar.name)}`,
          "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
          "X-PUBLISHED-TTL:PT1H",
        ]
      : []),
    ...calendar.events.flatMap((event) => eventLines(event, now)),
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function buildIcs(event: IcsEvent & { organizer: string; now?: Date }): string {
  return buildIcsCalendar({ organizer: event.organizer, now: event.now, events: [event] });
}

/** Lien « Ajouter à Google Agenda ». */
export function googleCalendarUrl(event: {
  title: string;
  startsAt: Date;
  endsAt: Date;
  location?: string | null;
  details?: string | null;
}) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${icsDate(event.startsAt)}/${icsDate(event.endsAt)}`,
  });
  if (event.location) params.set("location", event.location);
  if (event.details) params.set("details", event.details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

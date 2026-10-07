/** Formats affichés dans l'interface (français, fuseau de l'espace). */

const DEFAULT_TIME_ZONE = "Europe/Paris";

/** 24000 → « 240 € » ; 3550 → « 35,50 € ». */
export function formatMoney(cents: number, currency = "EUR"): string {
  const hasCents = cents % 100 !== 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })
    .format(cents / 100)
    .replace(/ /g, " ");
}

function part(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, ...options }).format(date);
}

/** « 9h », « 9h30 ». */
export function formatHour(date: Date, timeZone = DEFAULT_TIME_ZONE): string {
  const [hour = "0", minute = "00"] = part(date, timeZone, {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).split(":");
  return minute === "00" ? `${Number(hour)}h` : `${Number(hour)}h${minute}`;
}

/** « 9h – 12h ». */
export function formatTimeRange(start: Date, end: Date, timeZone = DEFAULT_TIME_ZONE): string {
  return `${formatHour(start, timeZone)} – ${formatHour(end, timeZone)}`;
}

/** Abréviations de la maquette : « Lun. », « Juil. »… */
function abbreviate(word: string): string {
  const clean = word.replace(/\.$/, "");
  const short = clean.length > 4 ? `${clean.slice(0, clean.startsWith("juil") ? 4 : 3)}.` : clean;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

export function formatWeekdayShort(date: Date, timeZone = DEFAULT_TIME_ZONE): string {
  return abbreviate(part(date, timeZone, { weekday: "long" }));
}

/** « Juin », « Juil. », « Août ». */
export function formatMonthShort(date: Date, timeZone = DEFAULT_TIME_ZONE): string {
  return abbreviate(part(date, timeZone, { month: "long" }));
}

export function formatDayNumber(date: Date, timeZone = DEFAULT_TIME_ZONE): string {
  return part(date, timeZone, { day: "numeric" });
}

/** « Mer. 17 juin · 11h ». */
export function formatDateTimeShort(date: Date, timeZone = DEFAULT_TIME_ZONE): string {
  const day = part(date, timeZone, { day: "numeric", month: "long" });
  return `${formatWeekdayShort(date, timeZone)} ${day} · ${formatHour(date, timeZone)}`;
}

/** « Mohamed Ndoye » → « MN ». */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0] ?? "";
  if (words.length === 1) return first.slice(0, 2).toUpperCase();
  return `${first.charAt(0)}${words.at(-1)?.charAt(0) ?? ""}`.toUpperCase();
}

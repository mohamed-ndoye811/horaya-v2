import type { EventTypeField, FieldValues } from "../fields/model";
import { ValidationError } from "../shared/errors";
import type {
  AccessModule,
  DepositModule,
  EventModules,
  ModuleKey,
  OpeningModule,
  PlacesModule,
} from "./registry";
import { CLIENT_ADDRESS_FIELD_KEY, type ResourceNames, resourceSummary } from "./resources";
import { durationTitle } from "./time";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/* ---------- Ouverture des inscriptions ---------- */

/** Fenêtre de réservation en ligne : ouverte de `opensAt` (null : dès la publication) à `closesAt`. */
export function bookingWindow(
  startsAt: Date,
  opening: OpeningModule | undefined,
): { opensAt: Date | null; closesAt: Date } {
  const opensAt = opening?.opensAt
    ? new Date(opening.opensAt)
    : opening?.opensDaysBefore
      ? new Date(startsAt.getTime() - opening.opensDaysBefore * DAY)
      : null;
  return {
    opensAt,
    closesAt: new Date(startsAt.getTime() - (opening?.closesHoursBefore ?? 0) * HOUR),
  };
}

export type WindowState = "upcoming" | "open" | "closed";

export function windowState(window: { opensAt: Date | null; closesAt: Date }, now: Date) {
  if (now >= window.closesAt) return "closed" as const;
  if (window.opensAt && now < window.opensAt) return "upcoming" as const;
  return "open" as const;
}

/* ---------- Annulation ---------- */

export interface CancellationPolicy {
  freeCancellationHours: number;
  lateCancellationRefundPercent: number;
}

/** Règle d'annulation d'un événement : celle de son module, sinon celle de la structure. */
export function cancellationPolicyOf(
  modules: EventModules,
  structure: CancellationPolicy,
): CancellationPolicy {
  return {
    freeCancellationHours: modules.cancellation?.freeHours ?? structure.freeCancellationHours,
    lateCancellationRefundPercent:
      modules.cancellation?.lateRefundPercent ?? structure.lateCancellationRefundPercent,
  };
}

/* ---------- Seuil de maintien ---------- */

/** Instant où l'on décide de maintenir ou d'annuler (J-x), ou null sans seuil. */
export function minimumDecisionAt(startsAt: Date, places: PlacesModule | undefined): Date | null {
  return places?.minimum ? new Date(startsAt.getTime() - places.minimum.daysBefore * DAY) : null;
}

/**
 * Où en est le seuil de maintien : `none` sans seuil ou une fois atteint ; `risk` la veille de
 * J-x s'il manque des inscrits ; `cancel` à partir de J-x s'il en manque encore.
 */
export function minimumState(
  startsAt: Date,
  places: PlacesModule | undefined,
  seatsHeld: number,
  now: Date,
): "none" | "waiting" | "risk" | "cancel" {
  const decideAt = minimumDecisionAt(startsAt, places);
  if (!decideAt || !places?.minimum || seatsHeld >= places.minimum.seats) return "none";
  if (now >= startsAt) return "none";
  if (now >= decideAt) return "cancel";
  if (now.getTime() >= decideAt.getTime() - DAY) return "risk";
  return "waiting";
}

/* ---------- Conditions d'accès ---------- */

export const AGE_FIELD_KEY = "age";

/** La question « Âge » que le module ajoute pour chaque participant. */
export const AGE_FIELD: EventTypeField = {
  key: AGE_FIELD_KEY,
  label: "Âge",
  type: "number",
  scope: "participant",
  required: true,
  help: "En années, le jour de l'événement",
};

/** La question « Adresse » du module Lieu chez le client. */
export const CLIENT_ADDRESS_FIELD: EventTypeField = {
  key: CLIENT_ADDRESS_FIELD_KEY,
  label: "Adresse où nous viendrons",
  type: "long_text",
  scope: "booking",
  required: true,
};

const hasAgeLimit = (access: AccessModule | undefined) => Boolean(access?.minAge || access?.maxAge);

/**
 * Avec une condition d'âge, le type demande l'âge de chaque participant : la question est
 * ajoutée si elle manque, rendue obligatoire si elle existe.
 */
export function withModuleFields(
  fields: EventTypeField[],
  modules: EventModules,
): EventTypeField[] {
  // Lieu « chez le client » : l'adresse est demandée à chaque inscription.
  if (
    modules.location?.mode === "client" &&
    !fields.some((field) => field.key === CLIENT_ADDRESS_FIELD_KEY)
  ) {
    fields = [...fields, CLIENT_ADDRESS_FIELD];
  }
  if (!hasAgeLimit(modules.access)) return fields;
  const existing = fields.find((field) => field.key === AGE_FIELD_KEY);
  if (!existing) return [...fields, AGE_FIELD];
  if (existing.type !== "number" || existing.scope !== "participant") {
    throw new ValidationError("La question « age » doit être un nombre, pour chaque participant", [
      { path: "fields", message: "La condition d'âge demande une question « Âge » (nombre)" },
    ]);
  }
  return fields.map((field) => {
    if (field.key !== AGE_FIELD_KEY) return field;
    const { condition: _condition, ...rest } = field;
    return { ...rest, required: true };
  });
}

/** « 12 ans minimum », « 8 à 12 ans », « Moins de 18 ans ». */
export function ageLabel(access: AccessModule | undefined): string | null {
  const { minAge, maxAge } = access ?? {};
  if (minAge && maxAge) return `${minAge} à ${maxAge} ans`;
  if (minAge) return `${minAge} ans minimum`;
  if (maxAge) return `${maxAge} ans maximum`;
  return null;
}

/** Contrôle l'âge de chaque participant (réponses déjà validées) ; un âge non renseigné passe. */
export function ageIssues(
  access: AccessModule | undefined,
  participants: Array<{ answers: FieldValues }>,
): Array<{ path: string; message: string }> {
  if (!hasAgeLimit(access)) return [];
  const label = ageLabel(access) ?? "";
  return participants.flatMap(({ answers }, index) => {
    const age = answers[AGE_FIELD_KEY];
    if (typeof age !== "number") return [];
    const outside =
      (access?.minAge !== undefined && age < access.minAge) ||
      (access?.maxAge !== undefined && age > access.maxAge);
    return outside
      ? [{ path: `participants.${index}.answers.${AGE_FIELD_KEY}`, message: `Réservé : ${label}` }]
      : [];
  });
}

/** Le client porte-t-il l'une des étiquettes demandées (sans tenir compte de la casse) ? */
export function hasAccessTag(access: AccessModule | undefined, tags: readonly string[]): boolean {
  if (!access?.tags?.length) return true;
  const owned = new Set(tags.map((tag) => tag.trim().toLowerCase()));
  return access.tags.some((tag) => owned.has(tag.trim().toLowerCase()));
}

/* ---------- Page publique ---------- */

/** Ce qu'un visiteur voit des modules : ni documents ni messages, sauf « À apporter ». */
export function publicModules(modules: EventModules): EventModules {
  const {
    documents: _documents,
    messages,
    equipment: _equipment,
    location,
    staff,
    ...rest
  } = modules;
  const visible: EventModules = rest;
  if (messages?.bring) visible.messages = { bring: messages.bring };
  // Le lien de visio ne se montre qu'une fois inscrit : il ne quitte pas le serveur.
  if (location) visible.location = { mode: location.mode };
  if (staff) visible.staff = { showOnPublicPage: staff.showOnPublicPage };
  return visible;
}

/* ---------- Reprise des données ---------- */

/** Anciens réglages d'un type (avant le lot 34). */
export interface LegacyTypeSettings {
  defaultCapacity: number | null;
  requiresApproval: boolean;
  bookingRules: {
    minAdvanceHours?: number;
    maxSeatsPerBooking?: number;
    waitlistEnabled?: boolean;
  };
}

/**
 * Modules qui reproduisent les anciens réglages : même conversion que la migration 0023
 * (testée contre elle dans packages/db).
 */
export function legacyModules(legacy: LegacyTypeSettings): EventModules {
  const { minAdvanceHours, maxSeatsPerBooking, waitlistEnabled } = legacy.bookingRules;
  const modules: EventModules = {};
  if (legacy.defaultCapacity !== null || maxSeatsPerBooking !== undefined) {
    modules.places = {
      ...(legacy.defaultCapacity !== null && { capacity: legacy.defaultCapacity }),
      ...(maxSeatsPerBooking !== undefined && { maxPerBooking: maxSeatsPerBooking }),
    };
  }
  if (waitlistEnabled) modules.waitlist = {};
  if (legacy.requiresApproval) modules.approval = {};
  if (minAdvanceHours) modules.opening = { closesHoursBefore: minAdvanceHours };
  return modules;
}

/* ---------- Résumés (lignes repliées de l'éditeur) ---------- */

/** « 45 € », « 12,50 € ». */
export const moneyLabel = (cents: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  })
    .format(cents / 100)
    .replace(/ | /g, " ");

const WEEKDAYS_SHORT = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

/** « J-1 », « 2 h avant », « le début ». */
export function closingLabel(hoursBefore: number | undefined): string {
  if (!hoursBefore) return "le début";
  if (hoursBefore % 24 === 0) return hoursBefore === 24 ? "la veille" : `J-${hoursBefore / 24}`;
  return `${hoursBefore} h avant`;
}

/** « 30 % », « 20 € par place ». */
export function depositLabel(deposit: DepositModule): string {
  return deposit.percent !== undefined
    ? `${deposit.percent} %`
    : `${moneyLabel(deposit.amountCents ?? 0)} par place`;
}

/** « le reste sur place », « le reste à régler plus tard ». */
export const balanceLabel = (deposit: DepositModule) =>
  deposit.balance === "later" ? "le reste à régler plus tard" : "le reste sur place";

export interface SummaryContext extends ResourceNames {
  /** « inscription », « réservation »… */
  noun: string;
  /** Formules de cartes de l'espace (module « Moyens acceptés »). */
  passPlans?: ReadonlyArray<{ id: string; name: string }>;
  structure: CancellationPolicy;
  /** Met en forme une date fixe d'ouverture (fuseau de l'espace). */
  formatDate?: (date: Date) => string;
}

/** Résumé d'un module sur sa ligne repliée (maquette 9.1). */
export function moduleSummary(
  key: ModuleKey,
  modules: EventModules,
  context: SummaryContext,
): string {
  const join = (parts: Array<string | number | null | false | undefined>) =>
    parts.filter(Boolean).join(" · ");
  switch (key) {
    case "places": {
      const places = modules.places ?? {};
      return join([
        places.capacity ? `${places.capacity} par séance` : "Illimitées par défaut",
        places.maxPerBooking && `${places.maxPerBooking} au plus par ${context.noun}`,
        places.minimum &&
          `maintenu à partir de ${places.minimum.seats}, sinon annulé à J-${places.minimum.daysBefore}`,
      ]);
    }
    case "waitlist":
      return "Quand c'est complet, la place libérée est proposée au suivant";
    case "approval":
      return "Chaque demande attend ton accord avant d'être confirmée";
    case "opening": {
      const opening = modules.opening ?? {};
      const opens = opening.opensAt
        ? `Ouvre le ${context.formatDate?.(new Date(opening.opensAt)) ?? opening.opensAt.slice(0, 10)}`
        : opening.opensDaysBefore
          ? `Ouvre à J-${opening.opensDaysBefore}`
          : "Ouvre dès la publication";
      return join([opens, `ferme ${closingLabel(opening.closesHoursBefore)}`]);
    }
    case "cancellation": {
      const policy = cancellationPolicyOf(modules, context.structure);
      const free = policy.freeCancellationHours
        ? `Gratuite jusqu'à ${policy.freeCancellationHours} h avant`
        : "Pas de délai gratuit";
      const late =
        policy.lateCancellationRefundPercent === 0
          ? "ensuite la séance est due"
          : policy.lateCancellationRefundPercent === 100
            ? "ensuite remboursée en entier"
            : `ensuite ${policy.lateCancellationRefundPercent} % remboursés`;
      return join([free, late, "règle propre à ce type"]);
    }
    case "access": {
      const access = modules.access ?? {};
      return (
        join([
          ageLabel(access),
          access.tags?.length && `réservé aux étiquettes ${access.tags.join(", ")}`,
          access.inviteOnly && "sur invitation",
        ]) || "Aucune condition pour l'instant"
      );
    }
    case "series": {
      const series = modules.series ?? {};
      return join([
        series.priceCents !== undefined
          ? `Prix de la série ${moneyLabel(series.priceCents)}`
          : "Prix de la série : séances × prix",
        series.dropInAllowed === false
          ? "pas de séance à l'unité"
          : "séance à l'unité encore possible",
        series.makeupAllowed !== false && "rattrapages",
      ]);
    }
    case "messages": {
      const messages = modules.messages ?? {};
      const reminder = messages.reminder
        ? messages.reminder.kind === "eve"
          ? `rappel la veille à ${messages.reminder.hour} h`
          : `rappel ${messages.reminder.hours} h avant`
        : "rappel la veille";
      return join([
        messages.bring && `« À apporter : ${messages.bring} » dans la confirmation`,
        messages.confirmation && !messages.bring && "texte dans la confirmation",
        reminder,
        messages.after && "message après la séance",
      ]);
    }
    case "equipment":
    case "location":
    case "staff":
      return resourceSummary(key, modules, context);
    case "pricing": {
      const pricing = modules.pricing ?? { rates: [] };
      return join([
        ...pricing.rates.map(
          (rate) =>
            `${rate.name} ${moneyLabel(rate.priceCents)}${rate.description ? ` (${rate.description})` : ""}`,
        ),
        ...(pricing.options ?? []).map(
          (option) => `${option.name} + ${moneyLabel(option.priceCents)}`,
        ),
      ]);
    }
    case "deposit": {
      const deposit = modules.deposit;
      return deposit
        ? `${depositLabel(deposit)} à l'${context.noun === "inscription" ? "inscription" : "réservation"} · ${balanceLabel(deposit)}`
        : "Aucun acompte";
    }
    case "payment_methods": {
      const methods = modules.payment_methods ?? {};
      const names = methods.passPlanIds
        ?.map((id) => context.passPlans?.find((plan) => plan.id === id)?.name)
        .filter(Boolean);
      const sessions = methods.sessionsPerSeat ?? 1;
      return join([
        methods.passes === false
          ? "Pas de carte de séances"
          : methods.passPlanIds
            ? names?.length
              ? `Cartes acceptées : ${names.join(", ")}`
              : "Aucune formule de carte choisie"
            : "Toutes les cartes de séances",
        methods.passes !== false && `${plural(sessions, "séance")} par place`,
        methods.giftCards === false ? "pas de bon cadeau" : "bons cadeaux acceptés",
      ]);
    }
    case "sessions": {
      const sessions = modules.sessions ?? {};
      return join([
        "Une inscription pour toutes les séances",
        sessions.singleSession ? "séance à l'unité possible" : "pas de séance à l'unité",
        sessions.sameEquipment && "même matériel à chaque séance",
      ]);
    }
    case "slots": {
      const slots = modules.slots;
      if (!slots) return "";
      const open = slots.weekly
        .map((ranges, day) => (ranges.length ? WEEKDAYS_SHORT[day] : null))
        .filter(Boolean);
      return join([
        open.length ? open.join(", ") : "Aucune disponibilité",
        `un départ toutes les ${slots.intervalMinutes} min`,
        slots.breakMinutes && `pause ${slots.breakMinutes} min`,
        `${plural(slots.seatsPerSlot ?? 1, "place")} par créneau`,
      ]);
    }
    case "duration": {
      const options = modules.duration?.options ?? [];
      return options
        .map((option) => `${durationTitle(option)} ${moneyLabel(option.priceCents)}`)
        .join(" · ");
    }
    case "documents": {
      const files = modules.documents?.files ?? [];
      return files.length
        ? `${plural(files.length, "document")} : ${files.map((file) => file.name).join(", ")}`
        : "Aucun document pour l'instant";
    }
  }
}

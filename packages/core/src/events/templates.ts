import type { EventTypeField } from "../fields/model";
import type { EventModules } from "../modules/registry";
import type { BookingNoun } from "./model";

/** Point de départ d'un nouveau type (maquette 9.3) : constantes, pas de table. */
export interface EventTypeTemplate {
  id: string;
  name: string;
  description: string;
  color: string;
  defaultDurationMinutes: number | null;
  defaultPriceCents: number | null;
  bookingNoun: BookingNoun;
  /** Modules du modèle (lot 34). */
  modules: EventModules;
  fields: EventTypeField[];
}

const level: EventTypeField = {
  key: "niveau",
  label: "Niveau",
  type: "choice",
  scope: "event",
  required: false,
  options: ["Débutant", "Intermédiaire", "Confirmé"],
  publicFilter: true,
};
const bring: EventTypeField = {
  key: "a_apporter",
  label: "À apporter",
  type: "long_text",
  scope: "event",
  required: false,
};
const rules: EventTypeField = {
  key: "reglement",
  label: "J'ai lu le règlement de l'atelier",
  type: "acceptance",
  scope: "booking",
  required: true,
};
const firstName: EventTypeField = {
  key: "prenom",
  label: "Prénom",
  type: "short_text",
  scope: "participant",
  required: true,
};

export const EVENT_TYPE_TEMPLATES: readonly EventTypeTemplate[] = [
  {
    id: "cours-collectif",
    name: "Cours collectif",
    description: "Une séance, un groupe, un prix.",
    color: "#A9663F",
    defaultDurationMinutes: 120,
    defaultPriceCents: 4500,
    bookingNoun: "inscription",
    modules: {
      places: { capacity: 12, minimum: { seats: 4, daysBefore: 2 } },
      waitlist: {},
      opening: { closesHoursBefore: 24 },
      cancellation: { freeHours: 48, lateRefundPercent: 0 },
      location: { mode: "venue" },
      staff: { showOnPublicPage: true },
      pricing: {
        rates: [
          { id: "plein", name: "Plein", priceCents: 4500 },
          {
            id: "reduit",
            name: "Réduit",
            priceCents: 3500,
            description: "étudiant, demandeur d'emploi",
          },
        ],
        options: [
          { id: "cuisson", name: "Cuisson et émaillage", priceCents: 800, per: "participant" },
        ],
      },
    },
    fields: [
      level,
      bring,
      {
        key: "deja_pratique",
        label: "Tu as déjà pratiqué ?",
        type: "boolean",
        scope: "booking",
        required: true,
      },
      {
        key: "depuis_quand",
        label: "Depuis combien de temps ?",
        type: "choice",
        scope: "booking",
        required: false,
        options: ["Moins d'un an", "1 à 3 ans", "Plus de 3 ans"],
        condition: { fieldKey: "deja_pratique", equals: true },
      },
      rules,
    ],
  },
  {
    id: "stage",
    name: "Stage",
    description: "Plusieurs séances, une seule inscription.",
    color: "#528D74",
    defaultDurationMinutes: 1440,
    defaultPriceCents: 25000,
    bookingNoun: "inscription",
    modules: {
      places: { capacity: 8, minimum: { seats: 4, daysBefore: 7 } },
      opening: { closesHoursBefore: 168 },
      sessions: { singleSession: false, sameEquipment: true },
      cancellation: { freeHours: 168, lateRefundPercent: 50 },
      pricing: {
        rates: [
          { id: "plein", name: "Plein", priceCents: 25000 },
          {
            id: "reduit",
            name: "Réduit",
            priceCents: 21000,
            description: "étudiant, demandeur d'emploi",
          },
        ],
        options: [
          {
            id: "dejeuner",
            name: "Déjeuner sur place",
            priceCents: 1500,
            per: "participant",
            max: 3,
          },
        ],
      },
      deposit: { percent: 30, balance: "on_site" },
    },
    fields: [
      level,
      { key: "programme", label: "Programme", type: "long_text", scope: "event", required: false },
      {
        key: "regime",
        label: "Régime alimentaire",
        type: "choice",
        scope: "participant",
        required: false,
        options: ["Aucun", "Végétarien", "Sans gluten"],
      },
      rules,
    ],
  },
  {
    id: "cours-annee",
    name: "Cours à l'année",
    description: "Chaque semaine, inscription au trimestre.",
    color: "#3165B8",
    defaultDurationMinutes: 120,
    defaultPriceCents: 3000,
    bookingNoun: "inscription",
    modules: {
      places: { capacity: 10 },
      waitlist: {},
      series: { dropInAllowed: true, prorata: true, makeupAllowed: true },
      pricing: {
        rates: [
          { id: "plein", name: "Plein", priceCents: 3000 },
          {
            id: "reduit",
            name: "Réduit",
            priceCents: 2500,
            description: "étudiant, moins de 18 ans",
          },
        ],
      },
    },
    fields: [level, firstName, rules],
  },
  {
    id: "rendez-vous",
    name: "Rendez-vous",
    description: "Cours particulier : l'élève choisit son créneau et sa durée.",
    color: "#CF879C",
    defaultDurationMinutes: 60,
    defaultPriceCents: 4500,
    bookingNoun: "reservation",
    modules: {
      places: { maxPerBooking: 1 },
      cancellation: { freeHours: 24, lateRefundPercent: 0 },
      slots: {
        weekly: [
          [],
          [{ start: "14:00", end: "18:00" }],
          [],
          [{ start: "14:00", end: "18:00" }],
          [],
          [{ start: "10:00", end: "13:00" }],
          [],
        ],
        intervalMinutes: 30,
        breakMinutes: 15,
        seatsPerSlot: 1,
        opensDaysBefore: 30,
        closesHoursBefore: 24,
        chooseStaff: true,
      },
      duration: {
        options: [
          { id: "1h", label: "1 h", minutes: 60, priceCents: 4500, description: "Découverte" },
          { id: "2h", label: "2 h", minutes: 120, priceCents: 8000 },
        ],
        defaultId: "1h",
      },
    },
    fields: [
      {
        key: "objectif",
        label: "Ce que tu aimerais travailler",
        type: "long_text",
        scope: "booking",
        required: false,
      },
    ],
  },
  {
    id: "location",
    name: "Location",
    description: "L'atelier ou du matériel, à l'heure ou à la journée.",
    color: "#D8BC66",
    defaultDurationMinutes: 240,
    defaultPriceCents: 4000,
    bookingNoun: "location",
    modules: {
      places: { capacity: 1 },
      approval: {},
      location: { mode: "venue" },
      duration: {
        options: [
          { id: "2h", label: "2 h", minutes: 120, priceCents: 2500 },
          { id: "demi-journee", label: "Demi-journée", minutes: 240, priceCents: 4000 },
          { id: "journee", label: "Journée", minutes: 480, priceCents: 7000 },
        ],
        defaultId: "demi-journee",
      },
      pricing: {
        rates: [{ id: "demi-journee", name: "Demi-journée", priceCents: 4000 }],
        options: [
          { id: "terre", name: "Pain de terre (10 kg)", priceCents: 1800, per: "booking", max: 5 },
        ],
      },
      deposit: { amountCents: 2000, balance: "on_site" },
    },
    fields: [
      {
        key: "usage",
        label: "Pour quoi faire ?",
        type: "long_text",
        scope: "booking",
        required: true,
      },
      rules,
    ],
  },
  {
    id: "privatisation",
    name: "Privatisation",
    description: "Anniversaire, team building, sur demande.",
    color: "#66537C",
    defaultDurationMinutes: 180,
    defaultPriceCents: 3500,
    bookingNoun: "demande",
    modules: {
      approval: {},
      pricing: {
        rates: [
          { id: "adulte", name: "Adulte", priceCents: 3500 },
          { id: "enfant", name: "Enfant", priceCents: 2500, description: "moins de 12 ans" },
        ],
        options: [
          { id: "gouter", name: "Goûter d'anniversaire", priceCents: 4000, per: "booking" },
          { id: "cuisson", name: "Cuisson des pièces", priceCents: 600, per: "participant" },
        ],
      },
      deposit: { percent: 30, balance: "later" },
      payment_methods: { passes: false },
    },
    fields: [
      {
        key: "occasion",
        label: "Occasion",
        type: "choice",
        scope: "booking",
        required: true,
        options: ["Anniversaire", "Entreprise", "Enterrement de vie", "Autre"],
      },
      {
        key: "nombre_personnes",
        label: "Nombre de personnes",
        type: "number",
        scope: "booking",
        required: true,
      },
      {
        key: "date_souhaitee",
        label: "Date souhaitée",
        type: "date",
        scope: "booking",
        required: false,
      },
    ],
  },
  {
    id: "soiree",
    name: "Soirée, événement",
    description: "Vernissage, marché, porte ouverte.",
    color: "#111111",
    defaultDurationMinutes: 180,
    defaultPriceCents: null,
    bookingNoun: "inscription",
    modules: { places: { capacity: 60 }, waitlist: {} },
    fields: [
      { key: "programme", label: "Programme", type: "long_text", scope: "event", required: false },
    ],
  },
  {
    id: "vide",
    name: "Type vide",
    description: "Aucun réglage. Tu construis tout, comme tu veux.",
    color: "#528D74",
    defaultDurationMinutes: null,
    defaultPriceCents: null,
    bookingNoun: "reservation",
    modules: {},
    fields: [],
  },
];

import type { EventTypeField } from "../fields/model";
import type { BookingNoun, BookingRules } from "./model";

/** Point de départ d'un nouveau type (maquette 9.3) : constantes, pas de table. */
export interface EventTypeTemplate {
  id: string;
  name: string;
  description: string;
  color: string;
  defaultDurationMinutes: number | null;
  defaultPriceCents: number | null;
  defaultCapacity: number | null;
  requiresApproval: boolean;
  bookingNoun: BookingNoun;
  bookingRules: BookingRules;
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
    defaultCapacity: 12,
    requiresApproval: false,
    bookingNoun: "inscription",
    bookingRules: { waitlistEnabled: true, minAdvanceHours: 24 },
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
    description: "Plusieurs jours, une seule inscription.",
    color: "#528D74",
    defaultDurationMinutes: 1440,
    defaultPriceCents: 25000,
    defaultCapacity: 8,
    requiresApproval: false,
    bookingNoun: "inscription",
    bookingRules: { minAdvanceHours: 168 },
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
    defaultCapacity: 10,
    requiresApproval: false,
    bookingNoun: "inscription",
    bookingRules: { waitlistEnabled: true },
    fields: [level, firstName, rules],
  },
  {
    id: "rendez-vous",
    name: "Rendez-vous",
    description: "Cours particulier, sur une heure fixée.",
    color: "#CF879C",
    defaultDurationMinutes: 60,
    defaultPriceCents: 6000,
    defaultCapacity: 1,
    requiresApproval: false,
    bookingNoun: "reservation",
    bookingRules: { maxSeatsPerBooking: 1, minAdvanceHours: 24 },
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
    defaultCapacity: 1,
    requiresApproval: true,
    bookingNoun: "location",
    bookingRules: {},
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
    defaultPriceCents: null,
    defaultCapacity: null,
    requiresApproval: true,
    bookingNoun: "demande",
    bookingRules: {},
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
    defaultCapacity: 60,
    requiresApproval: false,
    bookingNoun: "inscription",
    bookingRules: { waitlistEnabled: true },
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
    defaultCapacity: null,
    requiresApproval: false,
    bookingNoun: "reservation",
    bookingRules: {},
    fields: [],
  },
];

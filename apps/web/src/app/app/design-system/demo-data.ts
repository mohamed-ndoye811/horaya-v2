import type { BookingStatus } from "@horaya/core";
import type { CalendarEvent } from "@/components/calendar/types";

/** Données de démonstration reprises des maquettes Paper (juin 2026). */

export const CATEGORIES = [
  { name: "Séminaire", color: "#528D74" },
  { name: "Atelier", color: "#D8BC66" },
  { name: "Réunion", color: "#CF879C" },
  { name: "Meetup", color: "#66537C" },
];
const [seminaire, atelier, reunion, meetup] = CATEGORIES.map((category) => category.color) as [
  string,
  string,
  string,
  string,
];

export const TODAY = { year: 2026, month: 6, day: 15 };
/** Lundi 15 juin 2026, 10 h 40 à Paris. */
export const NOW = new Date("2026-06-15T08:40:00Z");

export interface DemoBooking {
  id: string;
  name: string;
  email: string;
  event: string;
  eventDate: Date;
  seats: number;
  amountCents: number;
  payment: string;
  status: BookingStatus;
}

export const BOOKINGS: DemoBooking[] = [
  {
    id: "1",
    name: "Léa Fontaine",
    email: "lea.fontaine@mail.com",
    event: "Atelier poterie",
    eventDate: new Date("2026-06-17T09:00:00Z"),
    seats: 1,
    amountCents: 3500,
    payment: "Carte",
    status: "pending",
  },
  {
    id: "2",
    name: "Antoine Leroy",
    email: "antoine.leroy@mail.com",
    event: "Hackathon IA & design",
    eventDate: new Date("2026-06-28T07:00:00Z"),
    seats: 4,
    amountCents: 0,
    payment: "Gratuit",
    status: "pending",
  },
  {
    id: "3",
    name: "Camille Roux",
    email: "camille.roux@mail.com",
    event: "Séminaire annuel",
    eventDate: new Date("2026-06-15T08:00:00Z"),
    seats: 2,
    amountCents: 24000,
    payment: "Carte",
    status: "confirmed",
  },
  {
    id: "4",
    name: "Thomas Bernard",
    email: "thomas.bernard@mail.com",
    event: "Atelier prise de parole",
    eventDate: new Date("2026-07-08T08:00:00Z"),
    seats: 1,
    amountCents: 8000,
    payment: "Acompte",
    status: "confirmed",
  },
  {
    id: "5",
    name: "Marc Dupont",
    email: "marc.dupont@mail.com",
    event: "Formation leadership",
    eventDate: new Date("2026-06-18T07:00:00Z"),
    seats: 3,
    amountCents: 12000,
    payment: "Remboursé",
    status: "refused",
  },
  {
    id: "6",
    name: "Isabelle Chen",
    email: "isabelle.chen@mail.com",
    event: "Conférence RSE 2026",
    eventDate: new Date("2026-07-15T12:00:00Z"),
    seats: 1,
    amountCents: 5000,
    payment: "Remboursé",
    status: "cancelled",
  },
  {
    id: "7",
    name: "Hugo Petit",
    email: "hugo.petit@mail.com",
    event: "Formation Excel avancé",
    eventDate: new Date("2026-06-22T12:00:00Z"),
    seats: 1,
    amountCents: 12000,
    payment: "Acompte",
    status: "waitlisted",
  },
];

export const UPCOMING = [
  {
    id: "a",
    title: "Atelier design thinking",
    color: atelier,
    date: new Date("2026-06-20T07:00:00Z"),
    detail: "Sam. 9h – 12h · Studio Créa · 8 places restantes",
    seatsHeld: 4,
    capacity: 12,
    status: "published" as const,
  },
  {
    id: "b",
    title: "Formation Excel avancé",
    color: seminaire,
    date: new Date("2026-06-22T12:00:00Z"),
    detail: "Lun. 14h – 17h · En ligne · 15 places restantes",
    seatsHeld: 5,
    capacity: 20,
    status: "published" as const,
  },
  {
    id: "c",
    title: "Réunion stratégique Q3",
    color: reunion,
    date: new Date("2026-06-25T08:00:00Z"),
    detail: "Jeu. 10h – 12h · Salle Horizon · 20 places",
    seatsHeld: 0,
    capacity: 20,
    status: "draft" as const,
  },
  {
    id: "d",
    title: "Hackathon IA & design",
    color: meetup,
    date: new Date("2026-06-28T07:00:00Z"),
    detail: "Dim. 9h – 18h · Station F · 3 places restantes",
    seatsHeld: 22,
    capacity: 25,
    status: "published" as const,
  },
  {
    id: "e",
    title: "Team building nature",
    color: meetup,
    date: new Date("2026-08-03T07:00:00Z"),
    detail: "Lun. 9h – 17h · Forêt de Fontainebleau · 0 place",
    seatsHeld: 30,
    capacity: 30,
    status: "published" as const,
  },
];

const at = (iso: string) => new Date(iso);

/** Événements du mois et de la semaine 24 (maquettes 06 et 07). */
export const CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: "1",
    title: "Petit-déj networking",
    color: meetup,
    startsAt: at("2026-06-03T07:00:00Z"),
    endsAt: at("2026-06-03T08:30:00Z"),
  },
  {
    id: "2",
    title: "Atelier céramique",
    color: atelier,
    startsAt: at("2026-06-05T12:00:00Z"),
    endsAt: at("2026-06-05T14:00:00Z"),
  },
  {
    id: "3",
    title: "Comité de direction",
    color: reunion,
    startsAt: at("2026-06-09T08:00:00Z"),
    endsAt: at("2026-06-09T09:00:00Z"),
  },
  {
    id: "4",
    title: "Formation sécurité",
    color: seminaire,
    startsAt: at("2026-06-11T07:00:00Z"),
    endsAt: at("2026-06-11T09:00:00Z"),
  },
  {
    id: "5",
    title: "Afterwork équipe",
    color: meetup,
    startsAt: at("2026-06-12T16:00:00Z"),
    endsAt: at("2026-06-12T18:00:00Z"),
  },
  {
    id: "6",
    title: "Séminaire annuel",
    color: seminaire,
    startsAt: at("2026-06-15T12:00:00Z"),
    endsAt: at("2026-06-16T14:30:00Z"),
  },
  {
    id: "7",
    title: "Inventaire matériel",
    color: atelier,
    startsAt: at("2026-06-14T22:00:00Z"),
    endsAt: at("2026-06-15T22:00:00Z"),
  },
  {
    id: "8",
    title: "Daily standup",
    color: meetup,
    startsAt: at("2026-06-15T07:30:00Z"),
    endsAt: at("2026-06-15T07:45:00Z"),
  },
  {
    id: "9",
    title: "Point client Vidal",
    color: reunion,
    startsAt: at("2026-06-15T09:00:00Z"),
    endsAt: at("2026-06-15T10:00:00Z"),
  },
  {
    id: "10",
    title: "Déjeuner équipe",
    color: atelier,
    startsAt: at("2026-06-15T10:30:00Z"),
    endsAt: at("2026-06-15T11:30:00Z"),
  },
  {
    id: "11",
    title: "Appel fournisseur",
    color: reunion,
    startsAt: at("2026-06-15T14:30:00Z"),
    endsAt: at("2026-06-15T15:00:00Z"),
  },
  {
    id: "12",
    title: "Revue produit",
    color: reunion,
    startsAt: at("2026-06-16T13:00:00Z"),
    endsAt: at("2026-06-16T14:30:00Z"),
    detail: "Salle Horizon",
  },
  {
    id: "13",
    title: "Atelier poterie",
    color: atelier,
    startsAt: at("2026-06-17T09:00:00Z"),
    endsAt: at("2026-06-17T10:30:00Z"),
    detail: "Pot's · 6 / 8 places",
  },
  {
    id: "14",
    title: "Festival Off — montage",
    color: meetup,
    startsAt: at("2026-06-18T07:00:00Z"),
    endsAt: at("2026-06-21T16:00:00Z"),
  },
  {
    id: "15",
    title: "Réunion client",
    color: reunion,
    startsAt: at("2026-06-18T12:00:00Z"),
    endsAt: at("2026-06-18T13:00:00Z"),
  },
  {
    id: "16",
    title: "Séminaire RH",
    color: seminaire,
    startsAt: at("2026-06-19T07:00:00Z"),
    endsAt: at("2026-06-19T09:00:00Z"),
  },
  {
    id: "17",
    title: "Onboarding",
    color: seminaire,
    startsAt: at("2026-06-19T09:00:00Z"),
    endsAt: at("2026-06-19T11:00:00Z"),
  },
  {
    id: "18",
    title: "Atelier design thinking",
    color: atelier,
    startsAt: at("2026-06-20T07:00:00Z"),
    endsAt: at("2026-06-20T10:00:00Z"),
  },
  {
    id: "19",
    title: "Meetup Brooklyn",
    color: meetup,
    startsAt: at("2026-06-20T08:00:00Z"),
    endsAt: at("2026-06-20T10:30:00Z"),
  },
  {
    id: "20",
    title: "Formation Excel avancé",
    color: seminaire,
    startsAt: at("2026-06-22T12:00:00Z"),
    endsAt: at("2026-06-22T15:00:00Z"),
  },
  {
    id: "21",
    title: "Réunion stratégique Q3",
    color: reunion,
    startsAt: at("2026-06-25T08:00:00Z"),
    endsAt: at("2026-06-25T10:00:00Z"),
  },
  {
    id: "22",
    title: "Hackathon IA & design",
    color: meetup,
    startsAt: at("2026-06-28T07:00:00Z"),
    endsAt: at("2026-06-28T16:00:00Z"),
  },
  {
    id: "23",
    title: "Bilan semestriel",
    color: reunion,
    startsAt: at("2026-06-30T14:00:00Z"),
    endsAt: at("2026-06-30T15:00:00Z"),
  },
  {
    id: "24",
    title: "Hackathon interne IA",
    color: meetup,
    startsAt: at("2026-07-01T07:00:00Z"),
    endsAt: at("2026-07-01T16:00:00Z"),
  },
];

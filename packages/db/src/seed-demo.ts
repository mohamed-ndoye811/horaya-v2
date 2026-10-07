/**
 * Remplit un espace avec des données de démonstration (reprises des maquettes Paper),
 * en passant par les cas d'usage du core : mêmes règles que l'app.
 *
 *   pnpm db:seed-demo <adresse-de-l-espace> [--reset]
 *
 * --reset vide d'abord l'espace (matériel, événements, réservations, clients, historique).
 */
import {
  type Actor,
  addCustomerNote,
  addDays,
  cancelBooking,
  createEvent,
  createEventBooking,
  createEventType,
  createItem,
  createRentalBooking,
  fromZonedParts,
  publishEvent,
  scheduleMaintenance,
  setEventItemQuantity,
  systemClock,
  toZonedParts,
  updateCustomer,
  updateTenantSettings,
} from "@horaya/core";
import { and, eq, inArray, ne } from "drizzle-orm";
import { createDb } from "./client";
import {
  activityLog,
  booking,
  bookingParticipant,
  customer,
  customerNote,
  event,
  eventSeries,
  eventType,
  invitation,
  item,
  itemAllocation,
  itemType,
  itemUnit,
  member,
  notificationPreference,
  organization,
  payment,
  referenceCounter,
  tenantSettings,
  user,
} from "./schema";
import { createUnitOfWork } from "./unit-of-work";

const TZ = "Europe/Paris";
const slug = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const reset = process.argv.includes("--reset");
if (!slug) {
  console.error("Usage : pnpm db:seed-demo <adresse-de-l-espace>");
  process.exit(1);
}

const db = createDb(process.env.DATABASE_URL ?? "", { maxConnections: 2 });
const deps = { uow: createUnitOfWork(db), clock: systemClock };

const [org] = await db.select().from(organization).where(eq(organization.slug, slug));
if (!org) throw new Error(`Aucun espace avec l'adresse « ${slug} »`);
const [owner] = await db
  .select()
  .from(member)
  .where(and(eq(member.organizationId, org.id), eq(member.role, "owner")));
if (!owner) throw new Error("Cet espace n'a pas de propriétaire");
if (reset) {
  await db.transaction(async (tx) => {
    const bookingIds = tx
      .select({ id: booking.id })
      .from(booking)
      .where(eq(booking.organizationId, org.id));
    await tx.delete(bookingParticipant).where(inArray(bookingParticipant.bookingId, bookingIds));
    // Paiements : on repart d'un espace sans compte Stripe connecté.
    await tx
      .update(tenantSettings)
      .set({ stripeAccountId: null, stripeAccountStatus: "not_connected" })
      .where(eq(tenantSettings.organizationId, org.id));
    // Équipe : on garde le propriétaire, on retire les autres membres et les invitations.
    await tx.delete(invitation).where(eq(invitation.organizationId, org.id));
    await tx.delete(member).where(and(eq(member.organizationId, org.id), ne(member.role, "owner")));
    for (const table of [
      notificationPreference,
      itemAllocation,
      itemUnit,
      item,
      itemType,
      payment,
      booking,
      event,
      eventSeries,
      eventType,
      customerNote,
      customer,
      activityLog,
      referenceCounter,
    ]) {
      await tx.delete(table).where(eq(table.organizationId, org.id));
    }
  });
  console.info(`Espace « ${org.name} » vidé.`);
}
const [existing] = await db
  .select({ id: event.id })
  .from(event)
  .where(eq(event.organizationId, org.id))
  .limit(1);
if (existing) {
  console.error(
    `L'espace « ${slug} » a déjà des événements : rien n'est ajouté (--reset pour repartir de zéro).`,
  );
  process.exit(1);
}

const actor: Actor = {
  type: "member",
  organizationId: org.id,
  userId: owner.userId,
  memberId: owner.id,
  role: "owner",
};

// Marque et réglages des maquettes (écrans 24 et 26).
await updateTenantSettings(deps, actor, {
  brandColor: "#528D74",
  displayFont: "display",
  description: "Séminaires et ateliers pour les équipes, à Puget-Ville.",
  vatRateBps: 2000,
  defaultDepositPercent: 30,
  freeCancellationHours: 72,
  lateCancellationRefundPercent: 50,
  // Lien de paiement d'exemple (domaine réservé example.com) pour la démo du paiement par lien.
  paymentLinkUrl: "https://example.com/paiement-cabinet-vidal",
});

const today = toZonedParts(new Date(), TZ);
/** Date dans `days` jours à `hour` h `minute` (heure de Paris). */
const at = (days: number, hour: number, minute = 0) =>
  fromZonedParts({ ...addDays(today, days), hour, minute }, TZ).toISOString();

const types = Object.fromEntries(
  await Promise.all(
    [
      {
        key: "seminaire",
        name: "Séminaire",
        color: "#528D74",
        defaultDurationMinutes: 60 * 24,
        defaultPriceCents: 12000,
        requiresApproval: true,
        bookingRules: { waitlistEnabled: true },
        customFields: [
          {
            key: "regime",
            label: "Régime alimentaire",
            type: "select" as const,
            required: false,
            options: ["Aucun", "Végétarien", "Végan", "Sans gluten", "Autre"],
          },
        ],
      },
      {
        key: "atelier",
        name: "Atelier",
        color: "#D8BC66",
        defaultDurationMinutes: 180,
        defaultPriceCents: 3500,
      },
      { key: "reunion", name: "Réunion", color: "#CF879C", defaultDurationMinutes: 60 },
      {
        key: "meetup",
        name: "Meetup",
        color: "#66537C",
        defaultDurationMinutes: 150,
        bookingRules: { waitlistEnabled: true },
      },
      {
        key: "formation",
        name: "Formation",
        color: "#264489",
        defaultDurationMinutes: 60 * 24,
        defaultPriceCents: 18000,
      },
      { key: "webinaire", name: "Webinaire", color: "#3165B8", defaultDurationMinutes: 90 },
    ].map(async ({ key, ...input }) => [key, await createEventType(deps, actor, input)] as const),
  ),
);

type Plan = {
  type: keyof typeof types;
  title: string;
  start: [number, number, number?];
  end: [number, number, number?];
  location?: string;
  capacity?: number | null;
  priceCents?: number;
  paymentMode?: "free" | "online" | "deposit" | "on_site";
  depositPercent?: number;
  publish?: boolean;
  /** Réunions internes : publiées pour l'équipe, absentes de la page publique. */
  internal?: boolean;
  description?: string;
  highlights?: string[];
  bookings?: Array<[string, string, number, ("pending" | "cancel")?, string?]>;
};

const plans: Plan[] = [
  {
    type: "seminaire",
    title: "Séminaire annuel",
    start: [1, 14],
    end: [2, 16, 30],
    location: "445 rue de la Thèse, Puget-Ville",
    capacity: 50,
    description:
      "Une journée complète dédiée à la stratégie et à la cohésion d'équipe. Au programme : ateliers en petits groupes, présentations plénières et temps d'échange dans un cadre lumineux et accessible.\n\nLe déjeuner est inclus. Le lieu est accessible PMR et desservi par les transports en commun.",
    highlights: ["Déjeuner inclus", "Accessible PMR", "Aucun matériel à apporter"],
    priceCents: 12000,
    paymentMode: "on_site",
    bookings: [
      ["Camille", "Roux", 2],
      ["Thomas", "Bernard", 1],
      ["Julie", "Moreau", 2],
      ["Hugo", "Petit", 1, "pending"],
      ["Léa", "Fontaine", 1],
      ["Antoine", "Leroy", 4],
    ],
  },
  {
    type: "meetup",
    title: "Daily standup",
    internal: true,
    start: [1, 9, 30],
    end: [1, 10],
    location: "Visio",
    capacity: null,
  },
  {
    type: "reunion",
    title: "Point client Vidal",
    internal: true,
    start: [1, 11],
    end: [1, 12],
    location: "Salle Horizon, 2e étage",
    capacity: 6,
  },
  {
    type: "atelier",
    title: "Atelier poterie",
    start: [2, 11],
    end: [2, 12, 30],
    location: "Pot's, 12 rue des Arts",
    capacity: 8,
    priceCents: 3500,
    paymentMode: "online",
    bookings: [
      [
        "Léa",
        "Fontaine",
        1,
        "pending",
        "Bonjour ! C'est ma première fois : faut-il apporter un tablier ? Et je suis allergique au gluten, est-ce un problème pour la collation ? Merci !",
      ],
      ["Sophie", "Martin", 3],
      ["Marc", "Dupont", 2],
    ],
  },
  {
    type: "atelier",
    title: "Atelier design thinking",
    start: [5, 9],
    end: [5, 12],
    location: "Studio Créa",
    capacity: 12,
    description:
      "Trois heures pour apprendre à résoudre un problème en équipe : observer, imaginer, prototyper, tester. Matériel fourni, aucune connaissance préalable.",
    highlights: ["Matériel fourni"],
    priceCents: 4500,
    paymentMode: "on_site",
    bookings: [
      ["Isabelle", "Chen", 2],
      ["Julie", "Moreau", 2],
    ],
  },
  {
    type: "formation",
    title: "Formation Excel avancé",
    start: [7, 14],
    end: [7, 17],
    location: "En ligne",
    capacity: 20,
    priceCents: 18000,
    paymentMode: "deposit",
    depositPercent: 30,
    bookings: [
      ["Hugo", "Petit", 1, "pending"],
      ["Thomas", "Bernard", 3],
      ["Camille", "Roux", 1],
    ],
  },
  {
    type: "reunion",
    title: "Réunion stratégique Q3",
    start: [10, 10],
    end: [10, 12],
    location: "Salle Horizon",
    capacity: 20,
    publish: false,
  },
  {
    type: "meetup",
    title: "Hackathon IA & design",
    start: [13, 9],
    end: [13, 18],
    location: "Station F",
    capacity: 25,
    bookings: [
      ["Antoine", "Leroy", 4, "pending"],
      ["Sophie", "Martin", 5],
      ["Marc", "Dupont", 3],
      ["Isabelle", "Chen", 5],
      ["Léa", "Fontaine", 5],
    ],
  },
  {
    type: "seminaire",
    title: "Séminaire leadership",
    start: [17, 11],
    end: [17, 17],
    location: "Hôtel Lutetia",
    capacity: 30,
    description:
      "Une journée pour les managers : posture, feedback et animation d'équipe, avec des mises en situation.",
    highlights: ["Déjeuner inclus"],
    priceCents: 24000,
    paymentMode: "on_site",
    bookings: [
      ["Marc", "Dupont", 3, "cancel"],
      ["Julie", "Moreau", 2],
    ],
  },
  {
    type: "atelier",
    title: "Atelier prise de parole",
    start: [23, 10],
    end: [23, 12],
    location: "Cabinet Orator",
    capacity: 8,
    priceCents: 8000,
    paymentMode: "deposit",
    depositPercent: 30,
    bookings: [
      ["Thomas", "Bernard", 1],
      ["Camille", "Roux", 2],
    ],
  },
  {
    type: "webinaire",
    title: "Webinaire cloud & DevOps",
    start: [26, 11],
    end: [26, 12, 30],
    location: "En ligne",
    capacity: 100,
    bookings: [["Hugo", "Petit", 1]],
  },
  {
    type: "seminaire",
    title: "Conférence RSE",
    start: [30, 14],
    end: [30, 18],
    location: "Palais des Congrès",
    capacity: 80,
    publish: false,
  },
  {
    type: "meetup",
    title: "Team building nature",
    start: [40, 9],
    end: [40, 17],
    location: "Forêt de Fontainebleau",
    capacity: 12,
    description:
      "Une journée au grand air : course d'orientation, cuisine au feu de bois et défis en équipe.",
    highlights: ["Navette depuis Paris", "Repas inclus"],
    bookings: [
      ["Sophie", "Martin", 6],
      ["Antoine", "Leroy", 6],
    ],
  },
];

let bookingCount = 0;
const eventIds = new Map<string, string>();
for (const plan of plans) {
  const [created] = await createEvent(deps, actor, {
    eventTypeId: types[plan.type]?.id ?? "",
    title: plan.title,
    startsAt: at(...(plan.start as [number, number, number?])),
    endsAt: at(...(plan.end as [number, number, number?])),
    timezone: TZ,
    locationName: plan.location,
    capacity: plan.capacity === undefined ? 20 : plan.capacity,
    priceCents: plan.priceCents ?? 0,
    paymentMode: plan.paymentMode ?? "free",
    depositPercent: plan.depositPercent ?? null,
    description: plan.description ?? "",
    highlights: plan.highlights ?? [],
    visibility: plan.internal ? "invite_only" : "public",
  });
  if (!created) continue;
  eventIds.set(plan.title, created.id);
  if (plan.publish === false) continue;
  // Un événement déjà commencé ne peut plus être publié : on décale la publication d'office.
  if (new Date(created.startsAt) > new Date()) await publishEvent(deps, actor, created.id);
  else continue;

  for (const [firstName, lastName, seats, state, message] of plan.bookings ?? []) {
    const local = `${firstName}.${lastName}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
    const email = `${local}@mail.com`;
    const bookingActor: Actor =
      state === "pending" ? { type: "customer", organizationId: org.id } : actor;
    try {
      const { booking } = await createEventBooking(deps, bookingActor, {
        eventId: created.id,
        seats,
        customer: { firstName, lastName, email },
        customerMessage: message ?? null,
      });
      if (state === "cancel") await cancelBooking(deps, actor, booking.id, "Empêchement");
      bookingCount++;
    } catch (error) {
      console.warn(`  ${plan.title} / ${firstName} : ${(error as Error).message}`);
    }
  }
}

// Fiches clients plus complètes (entreprises, téléphone, étiquettes, notes).
const profiles: Record<
  string,
  { company?: string; phone?: string; tags?: string[]; notes?: string[] }
> = {
  "camille.roux@mail.com": {
    company: "Cabinet Vidal",
    phone: "06 12 34 56 78",
    tags: ["vip"],
    notes: [
      "Allergie aux fruits à coque — prévenir le traiteur.",
      "Réserve souvent pour toute son équipe (6–8 pers.). Préfère une facture unique en fin de mois.",
    ],
  },
  "julie.moreau@mail.com": { company: "Groupe Azur RH" },
  "marc.dupont@mail.com": { company: "Leadership & Co", phone: "06 98 76 54 32" },
  "lea.fontaine@mail.com": { phone: "06 12 34 56 78" },
};
for (const [email, profile] of Object.entries(profiles)) {
  const [found] = await db
    .select({ id: customer.id })
    .from(customer)
    .where(and(eq(customer.organizationId, org.id), eq(customer.email, email)));
  if (!found) continue;
  const { notes, ...fields } = profile;
  await updateCustomer(deps, actor, found.id, fields);
  for (const body of notes ?? []) await addCustomerNote(deps, actor, found.id, { body });
}

// Matériel (écrans 20-21) : articles, matériel des événements, locations, maintenances.
const items = Object.fromEntries(
  await Promise.all(
    [
      {
        key: "vp",
        name: "Vidéoprojecteur Epson 4K",
        reference: "VP-014",
        typeName: "Vidéo",
        quantity: 3,
        dailyRateCents: 4500,
        depositCents: 30000,
        storageLocation: "Local A · étagère 3",
        purchasedOn: "2025-03-12",
        purchasePriceCents: 189000,
      },
      {
        key: "sono",
        name: "Sono Bose L1 Pro",
        reference: "SN-003",
        typeName: "Sono",
        quantity: 2,
        dailyRateCents: 8000,
        depositCents: 50000,
        storageLocation: "Local A · étagère 1",
      },
      {
        key: "micro",
        name: "Micro sans fil Shure SM58",
        reference: "MC-021",
        typeName: "Sono",
        quantity: 6,
        dailyRateCents: 1500,
        storageLocation: "Local A · bac micros",
      },
      {
        key: "chaises",
        name: "Chaises pliantes noires",
        reference: "MB-100",
        typeName: "Mobilier",
        quantity: 150,
        dailyRateCents: 200,
        storageLocation: "Réserve B",
      },
      {
        key: "van",
        name: "Van Renault Trafic 9 places",
        reference: "VH-001",
        typeName: "Véhicule",
        quantity: 1,
        dailyRateCents: 12000,
        depositCents: 100000,
        storageLocation: "Parking -1",
      },
      {
        key: "drone",
        name: "Drone DJI Mini 4 Pro",
        reference: "DR-002",
        typeName: "Vidéo",
        quantity: 1,
        dailyRateCents: 6000,
        depositCents: 40000,
        storageLocation: "Local A · armoire",
      },
      {
        key: "tente",
        name: "Tente pliante 3 × 3 m",
        reference: "EX-008",
        typeName: "Extérieur",
        quantity: 4,
        dailyRateCents: 3500,
        storageLocation: "Réserve B",
      },
      {
        key: "ecran",
        name: "Écran LED 55 pouces sur pied",
        reference: "VD-007",
        typeName: "Vidéo",
        quantity: 2,
        dailyRateCents: 5000,
        depositCents: 30000,
        storageLocation: "Local A · étagère 2",
      },
    ].map(
      async ({ key, ...input }) =>
        [key, await createItem(deps, actor, { ...input, rentable: true })] as const,
    ),
  ),
);
const itemId = (key: string) => items[key]?.id ?? "";

const eventItems: Array<[string, string, number]> = [
  ["Point client Vidal", "vp", 1],
  ["Séminaire annuel", "vp", 1],
  ["Séminaire annuel", "micro", 3],
  ["Séminaire annuel", "chaises", 50],
  ["Atelier poterie", "ecran", 1],
  ["Formation Excel avancé", "vp", 1],
  ["Réunion stratégique Q3", "vp", 1],
  ["Hackathon IA & design", "vp", 1],
  ["Hackathon IA & design", "sono", 1],
  ["Hackathon IA & design", "ecran", 2],
  ["Hackathon IA & design", "chaises", 25],
  ["Team building nature", "tente", 4],
  ["Team building nature", "van", 1],
];
for (const [title, key, quantity] of eventItems) {
  const eventId = eventIds.get(title);
  if (eventId) await setEventItemQuantity(deps, actor, { eventId, itemId: itemId(key), quantity });
}

const rentals: Array<{
  key: string;
  quantity: number;
  from: [number, number];
  to: [number, number];
  who: [string, string];
}> = [
  { key: "sono", quantity: 1, from: [-1, 9], to: [3, 18], who: ["Marc", "Dupont"] },
  { key: "van", quantity: 1, from: [0, 8], to: [2, 20], who: ["Antoine", "Leroy"] },
  { key: "vp", quantity: 1, from: [5, 9], to: [7, 18], who: ["Isabelle", "Chen"] },
  { key: "micro", quantity: 2, from: [3, 14], to: [4, 12], who: ["Julie", "Moreau"] },
];
for (const rental of rentals) {
  const [firstName, lastName] = rental.who;
  const email = `${firstName}.${lastName}@mail.com`.toLowerCase();
  await createRentalBooking(deps, actor, {
    itemId: itemId(rental.key),
    quantity: rental.quantity,
    startsAt: at(...rental.from),
    endsAt: at(...rental.to),
    customer: { firstName, lastName, email },
  });
}

const unitIds = async (key: string, labels?: string[]) => {
  const rows = await db
    .select({ id: itemUnit.id, label: itemUnit.label })
    .from(itemUnit)
    .where(eq(itemUnit.itemId, itemId(key)));
  return rows.filter((row) => !labels || labels.includes(row.label)).map((row) => row.id);
};
const maintenances: Array<{
  key: string;
  labels?: string[];
  from: number;
  to: number;
  title: string;
  provider?: string;
  costCents?: number;
}> = [
  { key: "drone", from: -2, to: 3, title: "Hélice cassée · en réparation", provider: "DJI Care" },
  {
    key: "vp",
    labels: ["#3"],
    from: 9,
    to: 11,
    title: "Révision lampe",
    provider: "Atelier ProVidéo Toulon",
  },
  { key: "vp", from: -190, to: -189, title: "Nettoyage filtres", provider: "En interne" },
  {
    key: "vp",
    labels: ["#1"],
    from: -320,
    to: -318,
    title: "Remplacement télécommande",
    provider: "Pièce commandée",
    costCents: 2400,
  },
  {
    key: "micro",
    labels: ["#6"],
    from: 1,
    to: 6,
    title: "Capsule à remplacer",
    provider: "Shure SAV",
  },
];
for (const entry of maintenances) {
  await scheduleMaintenance(deps, actor, {
    itemId: itemId(entry.key),
    unitIds: await unitIds(entry.key, entry.labels),
    startsAt: at(entry.from, 0),
    endsAt: at(entry.to, 0),
    title: entry.title,
    provider: entry.provider ?? null,
    costCents: entry.costCents ?? null,
  });
}

// Équipe (écran 25) : comptes de démonstration sans mot de passe, et une invitation en attente.
const teammates: Array<[string, string, "editor" | "viewer"]> = [
  ["Camille", "Roux", "editor"],
  ["Thomas", "Bernard", "editor"],
  ["Pauline", "Vidal", "viewer"],
];
for (const [firstName, lastName, role] of teammates) {
  const email = `${firstName}.${lastName}@cabinet-vidal.fr`.toLowerCase();
  const [existingUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  const userId =
    existingUser?.id ??
    (
      await db
        .insert(user)
        .values({
          name: `${firstName} ${lastName}`,
          firstName,
          lastName,
          email,
          emailVerified: true,
        })
        .returning({ id: user.id })
    )[0]?.id;
  if (!userId) continue;
  const [already] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, org.id), eq(member.userId, userId)));
  if (!already) {
    await db.insert(member).values({ organizationId: org.id, userId, role, createdAt: new Date() });
  }
}
const now = Date.now();
await db.insert(invitation).values({
  organizationId: org.id,
  email: "julie.moreau@cabinet-vidal.fr",
  role: "viewer",
  status: "pending",
  createdAt: new Date(now - 2 * 86_400_000),
  expiresAt: new Date(now + 5 * 86_400_000),
  inviterId: owner.userId,
});

console.info(
  `Espace « ${org.name} » : ${Object.keys(types).length} types, ${plans.length} événements, ${bookingCount} réservations, ${Object.keys(items).length} articles, ${rentals.length} locations, ${teammates.length} coéquipiers.`,
);
await db.$client.end();

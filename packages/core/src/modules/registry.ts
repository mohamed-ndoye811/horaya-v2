import { z } from "zod";

/**
 * Modules d'un type d'événement (lot 34) : ce que Horaya fait pour ce type. Une clé par module
 * actif dans `event_type.modules` ; module absent = inactif, réglage absent = valeur de la
 * structure. L'événement en garde une copie à sa création (comme les champs, lot 33).
 */

const hours = z
  .int({ error: "Nombre d'heures invalide" })
  .min(0)
  .max(24 * 90);
const cents = z.int({ error: "Prix invalide" }).min(0).max(10_000_000, "Prix trop élevé");

export const placesModuleSchema = z.object({
  /** Places proposées par défaut à la création d'un événement (absent = illimitées). */
  capacity: z.int({ error: "Nombre de places invalide" }).min(1).max(100_000).optional(),
  /** Places au plus par inscription en ligne. */
  maxPerBooking: z.int({ error: "Nombre invalide" }).min(1, "Au moins 1").max(1000).optional(),
  /** Seuil de maintien : en dessous de `seats` places prises à J-`daysBefore`, l'événement est annulé. */
  minimum: z
    .object({
      seats: z.int({ error: "Seuil invalide" }).min(1, "Au moins 1").max(100_000),
      daysBefore: z.int({ error: "Jour invalide" }).min(1, "Au plus tard J-1").max(60),
    })
    .optional(),
});

/** Pas de réglage : le module actif suffit. */
const flagModuleSchema = z.object({});

export const openingModuleSchema = z
  .object({
    /** Ouverture N jours avant le début. */
    opensDaysBefore: z.int({ error: "Nombre de jours invalide" }).min(1).max(365).optional(),
    /** Ouverture à une date fixe (instant ISO). */
    opensAt: z.iso.datetime({ offset: true, error: "Date d'ouverture invalide" }).optional(),
    /** Fermeture X heures avant le début (0 ou absent : au début). */
    closesHoursBefore: hours.optional(),
  })
  .refine((value) => !(value.opensDaysBefore && value.opensAt), {
    message: "Choisis une ouverture à J-N ou à une date fixe, pas les deux",
    path: ["opensAt"],
  });

export const cancellationModuleSchema = z.object({
  /** Annulation gratuite jusqu'à X heures avant (0 : jusqu'au début, sans délai gratuit). */
  freeHours: hours.optional(),
  /** Part remboursée après le délai, en %. */
  lateRefundPercent: z.int({ error: "Pourcentage invalide" }).min(0).max(100).optional(),
});

export const accessModuleSchema = z
  .object({
    minAge: z.int({ error: "Âge invalide" }).min(1).max(120).optional(),
    maxAge: z.int({ error: "Âge invalide" }).min(1).max(120).optional(),
    /** Réservé aux clients qui portent l'une de ces étiquettes. */
    tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    /** Les événements du type sont créés « sur invitation ». */
    inviteOnly: z.boolean().optional(),
  })
  .refine((value) => !(value.minAge && value.maxAge && value.minAge > value.maxAge), {
    message: "L'âge minimum dépasse l'âge maximum",
    path: ["maxAge"],
  });

/** « Inscription à la série » (lot 30) : réglage de départ des nouvelles séries du type. */
export const seriesModuleSchema = z.object({
  /** Prix de la série ; absent = prix d'une séance × nombre de séances. */
  priceCents: cents.optional(),
  dropInAllowed: z.boolean().optional(),
  prorata: z.boolean().optional(),
  makeupAllowed: z.boolean().optional(),
});

export const messagesModuleSchema = z.object({
  /** Texte ajouté à l'e-mail de confirmation. */
  confirmation: z.string().trim().max(1000).optional(),
  /** « À apporter » : confirmation, rappel et page publique. */
  bring: z.string().trim().max(300).optional(),
  /** Moment du rappel au client (absent : la veille, comme pour tous les événements). */
  reminder: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("eve"), hour: z.int().min(0).max(23) }),
      z.object({ kind: z.literal("before"), hours: z.int().min(1).max(72) }),
    ])
    .optional(),
  /** Message envoyé après la séance. */
  after: z.string().trim().max(1000).optional(),
});

/** Adresse d'un fichier rangé par l'app (`/fichiers/<espace>/documents/<uuid>.pdf`). */
export const DOCUMENT_URL = /^\/fichiers\/[\w-]{1,64}\/documents\/[0-9a-f-]{36}\.pdf$/;

export const documentsModuleSchema = z.object({
  files: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        url: z.string().regex(DOCUMENT_URL, "Document inattendu"),
        size: z.int().min(0),
      }),
    )
    .max(5, "5 documents au plus"),
});

/** Quantité de matériel par place, qui le choisit (lot 34b). */
export const EQUIPMENT_CHOOSERS = ["workshop", "student"] as const;
export type EquipmentChooser = (typeof EQUIPMENT_CHOOSERS)[number];

export const equipmentNeedSchema = z.object({
  /** Clé stable du besoin (les réservations la gardent). */
  id: z.string().trim().min(1).max(40),
  /** Catégorie de matériel (`item_type`) dont on tire les exemplaires. */
  itemTypeId: z.uuid({ error: "Choisis un type de matériel" }),
  perSeat: z.int({ error: "Quantité invalide" }).min(1, "Au moins 1").max(20, "20 au plus"),
  /** Obligatoire : réservé à chaque inscription ; facultatif : case à cocher dans le formulaire. */
  required: z.boolean(),
  /** `workshop` : l'atelier attribue ; `student` : l'élève choisit l'exemplaire en ligne. */
  chooser: z.enum(EQUIPMENT_CHOOSERS),
  /** Exemplaires proposés sur cet événement (restriction posée à sa création) ; absent : tous. */
  unitIds: z.array(z.uuid()).max(500).optional(),
});

export const equipmentModuleSchema = z
  .object({ needs: z.array(equipmentNeedSchema).max(10, "10 besoins au plus") })
  .refine((value) => new Set(value.needs.map((need) => need.id)).size === value.needs.length, {
    message: "Deux besoins portent le même identifiant",
    path: ["needs"],
  });

/** Ce que le client décide dans le formulaire d'inscription, besoin par besoin. */
export const equipmentChoiceSchema = z.object({
  needId: z.string().trim().min(1).max(40),
  /** Matériel facultatif : coché ou non. */
  wanted: z.boolean().optional(),
  /** « L'élève choisit » : les exemplaires désignés. */
  unitIds: z.array(z.uuid()).max(100).optional(),
});
export type EquipmentChoice = z.output<typeof equipmentChoiceSchema>;

export const LOCATION_MODES = ["venue", "online", "client"] as const;
export type LocationMode = (typeof LOCATION_MODES)[number];

export const locationModuleSchema = z.object({
  /** À l'atelier, en ligne, ou chez le client. */
  mode: z.enum(LOCATION_MODES),
  /** À l'atelier : une autre adresse que celle de l'espace. */
  address: z.string().trim().max(300).optional(),
  /** En ligne : lien de visio par défaut des événements (jamais public avant l'inscription). */
  onlineUrl: z.url({ error: "Lien invalide" }).optional(),
});

export const staffModuleSchema = z.object({
  /** Membres proposés pour le type (absent ou vide : toute l'équipe). */
  memberIds: z.array(z.uuid()).max(50).optional(),
  /** Le prénom de l'intervenant est affiché sur la page publique. */
  showOnPublicPage: z.boolean().optional(),
});

/* ---------- L'argent (lot 35) ---------- */

/** Identifiant stable d'un tarif ou d'une option (l'événement et les réservations s'y réfèrent). */
const priceId = z.string().regex(/^[a-z0-9-]{1,40}$/, "Identifiant invalide");

export const rateSchema = z.object({
  id: priceId,
  name: z.string().trim().min(1, "Nomme le tarif").max(40),
  priceCents: cents,
  /** « étudiant, demandeur d'emploi » */
  description: z.string().trim().max(120).optional(),
});

export const OPTION_PER = ["booking", "participant"] as const;
export type OptionPer = (typeof OPTION_PER)[number];

export const priceOptionSchema = z.object({
  id: priceId,
  name: z.string().trim().min(1, "Nomme l'option").max(60),
  priceCents: cents,
  /** Une fois par inscription, ou une fois par participant. */
  per: z.enum(OPTION_PER),
  /** Quantité au plus (par inscription ou par participant) ; absent : 1, une case à cocher. */
  max: z.int({ error: "Quantité invalide" }).min(1, "Au moins 1").max(99).optional(),
  /**
   * Besoin de matériel facultatif (module Matériel avancé) réservé quand l'option est prise : un
   * matériel facultatif payant passe par son option, qui remplace sa case à cocher.
   */
  needId: z.string().trim().min(1).max(40).optional(),
});

export const pricingModuleSchema = z
  .object({
    rates: z.array(rateSchema).min(1, "Au moins un tarif").max(10, "10 tarifs au plus"),
    /** Tarif choisi d'office ; absent : le premier. */
    defaultRateId: priceId.optional(),
    options: z.array(priceOptionSchema).max(20, "20 options au plus").optional(),
  })
  .refine(
    (value) => {
      const ids = [...value.rates, ...(value.options ?? [])].map((entry) => entry.id);
      return new Set(ids).size === ids.length;
    },
    { message: "Deux tarifs ou options ont le même identifiant", path: ["rates"] },
  )
  .refine(
    (value) =>
      value.defaultRateId === undefined ||
      value.rates.some((rate) => rate.id === value.defaultRateId),
    { message: "Tarif par défaut inconnu", path: ["defaultRateId"] },
  );

export const depositModuleSchema = z
  .object({
    /** Part du total payée à l'inscription. */
    percent: z.int({ error: "Pourcentage invalide" }).min(1, "Entre 1 et 99 %").max(99).optional(),
    /** Ou un montant fixe par place (jamais plus que le total). */
    amountCents: cents.min(1, "Indique un montant").optional(),
    /** Le reste : sur place (défaut) ou plus tard, avec le lien de paiement. */
    balance: z.enum(["on_site", "later"]).optional(),
  })
  .refine((value) => (value.percent === undefined) !== (value.amountCents === undefined), {
    message: "Choisis un pourcentage ou un montant fixe",
    path: ["percent"],
  });

export const paymentMethodsModuleSchema = z.object({
  /** Cartes de séances acceptées (absent : oui). */
  passes: z.boolean().optional(),
  /** Formules acceptées ; absent : toutes. */
  passPlanIds: z.array(z.uuid()).max(50).optional(),
  /** Séances débitées par place (absent : 1). */
  sessionsPerSeat: z.int({ error: "Nombre invalide" }).min(1).max(20).optional(),
  /** Bons cadeaux acceptés (absent : oui). */
  giftCards: z.boolean().optional(),
});

/* ---------- Le temps (lot 37) ---------- */

/** « Plusieurs séances » : un stage, une inscription pour toutes ses dates (réglage de départ). */
export const sessionsModuleSchema = z.object({
  /** Les élèves peuvent aussi réserver une seule séance. */
  singleSession: z.boolean().optional(),
  /** Le même matériel (le même tour) est réservé à l'élève sur toutes les séances. */
  sameEquipment: z.boolean().optional(),
});

/** Heure murale « 14:00 ». */
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide (HH:MM)");
/** Date civile « 2026-12-23 ». */
const civilDate = z.iso.date({ error: "Date invalide" });

export const timeRangeSchema = z
  .object({ start: clockTime, end: clockTime })
  .refine((range) => range.start < range.end, {
    message: "La fin doit suivre le début",
    path: ["end"],
  });
export type TimeRange = z.output<typeof timeRangeSchema>;

export const closureSchema = z
  .object({
    from: civilDate,
    to: civilDate,
    label: z.string().trim().max(40).optional(),
  })
  .refine((closure) => closure.from <= closure.to, {
    message: "La fin précède le début",
    path: ["to"],
  });
export type Closure = z.output<typeof closureSchema>;

export const slotsModuleSchema = z
  .object({
    /** Plages de chaque jour de la semaine, 0 = lundi … 6 = dimanche ; vide : fermé. */
    weekly: z.array(z.array(timeRangeSchema).max(6, "6 plages au plus par jour")).length(7),
    /** Fermetures datées (vacances), dates incluses. */
    closures: z.array(closureSchema).max(30, "30 fermetures au plus").optional(),
    /** Un départ toutes les N minutes. */
    intervalMinutes: z.int({ error: "Intervalle invalide" }).min(5).max(480),
    /** Pause entre deux élèves. */
    breakMinutes: z.int({ error: "Pause invalide" }).min(0).max(240).optional(),
    /** Places par créneau (1 : cours particulier). */
    seatsPerSlot: z.int({ error: "Nombre de places invalide" }).min(1).max(100).optional(),
    /** Réservable au plus tôt N jours avant. */
    opensDaysBefore: z.int({ error: "Nombre de jours invalide" }).min(1).max(365).optional(),
    /** Réservable au plus tard X heures avant. */
    closesHoursBefore: hours.optional(),
    /** Intervenants proposés (vide : pas d'intervenant attaché au créneau). */
    memberIds: z.array(z.uuid()).max(50).optional(),
    /** L'élève choisit avec qui (sinon : le premier intervenant libre). */
    chooseStaff: z.boolean().optional(),
  })
  .superRefine((slots, context) => {
    for (const [day, ranges] of slots.weekly.entries()) {
      const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
      for (let index = 1; index < sorted.length; index++) {
        if ((sorted[index] as TimeRange).start < (sorted[index - 1] as TimeRange).end) {
          context.addIssue({
            code: "custom",
            message: "Deux plages se chevauchent",
            path: ["weekly", day],
          });
          break;
        }
      }
    }
  });
export type SlotsModule = z.output<typeof slotsModuleSchema>;

export const durationOptionSchema = z.object({
  id: priceId,
  /** « 1 h », « Journée ». */
  label: z.string().trim().min(1, "Nomme la durée").max(40),
  minutes: z
    .int({ error: "Durée invalide" })
    .min(5, "5 minutes au moins")
    .max(24 * 60, "24 heures au plus"),
  priceCents: cents,
  /** « Découverte », « Repas compris ». */
  description: z.string().trim().max(120).optional(),
});
export type DurationOption = z.output<typeof durationOptionSchema>;

export const durationModuleSchema = z
  .object({
    options: z
      .array(durationOptionSchema)
      .min(1, "Au moins une durée")
      .max(10, "10 durées au plus"),
    /** Durée choisie d'office ; absent : la première. */
    defaultId: priceId.optional(),
  })
  .refine(
    (value) => new Set(value.options.map((option) => option.id)).size === value.options.length,
    {
      message: "Deux durées ont le même identifiant",
      path: ["options"],
    },
  )
  .refine(
    (value) =>
      value.defaultId === undefined ||
      value.options.some((option) => option.id === value.defaultId),
    { message: "Durée par défaut inconnue", path: ["defaultId"] },
  );
export type DurationModule = z.output<typeof durationModuleSchema>;

/** Schéma de chaque module disponible (les modules « Bientôt » n'en ont pas encore). */
export const MODULE_SCHEMAS = {
  places: placesModuleSchema,
  waitlist: flagModuleSchema,
  approval: flagModuleSchema,
  opening: openingModuleSchema,
  cancellation: cancellationModuleSchema,
  access: accessModuleSchema,
  series: seriesModuleSchema,
  messages: messagesModuleSchema,
  documents: documentsModuleSchema,
  equipment: equipmentModuleSchema,
  location: locationModuleSchema,
  staff: staffModuleSchema,
  pricing: pricingModuleSchema,
  deposit: depositModuleSchema,
  payment_methods: paymentMethodsModuleSchema,
  sessions: sessionsModuleSchema,
  slots: slotsModuleSchema,
  duration: durationModuleSchema,
} as const;

export type ModuleKey = keyof typeof MODULE_SCHEMAS;
export const MODULE_KEYS = Object.keys(MODULE_SCHEMAS) as ModuleKey[];

/** Les modules actifs d'un type (ou la copie d'un événement). Les clés inconnues sont ignorées. */
export const eventTypeModulesSchema = z
  .object(
    Object.fromEntries(MODULE_KEYS.map((key) => [key, MODULE_SCHEMAS[key].optional()])) as {
      [K in ModuleKey]: z.ZodOptional<(typeof MODULE_SCHEMAS)[K]>;
    },
  )
  .superRefine((modules, context) => {
    // Trois façons de poser les dates : une seule à la fois.
    const timing = (["series", "sessions", "slots"] as const).filter((key) => modules[key]);
    if (timing.length > 1) {
      context.addIssue({
        code: "custom",
        message:
          "Créneaux, Plusieurs séances et Inscription à la série ne vont pas ensemble : garde-en un",
        path: [timing[1] as string],
      });
    }
    // Option liée au matériel : un besoin facultatif du module, une seule option par besoin.
    const linked = new Set<string>();
    for (const [index, option] of (modules.pricing?.options ?? []).entries()) {
      if (option.needId === undefined) continue;
      const need = modules.equipment?.needs.find((entry) => entry.id === option.needId);
      const message = !need
        ? "Ce matériel n'est pas dans le module Matériel avancé"
        : need.required
          ? "Le matériel obligatoire est inclus : il ne peut pas être une option"
          : linked.has(need.id)
            ? "Ce matériel est déjà lié à une autre option"
            : (option.max ?? 1) > 1
              ? "Une option liée au matériel se prend une fois (par participant ou par inscription)"
              : null;
      if (message)
        context.addIssue({
          code: "custom",
          message,
          path: ["pricing", "options", index, "needId"],
        });
      linked.add(option.needId);
    }
  });
export type EventModules = z.output<typeof eventTypeModulesSchema>;
export type PlacesModule = z.output<typeof placesModuleSchema>;
export type OpeningModule = z.output<typeof openingModuleSchema>;
export type CancellationModule = z.output<typeof cancellationModuleSchema>;
export type AccessModule = z.output<typeof accessModuleSchema>;
export type SeriesModule = z.output<typeof seriesModuleSchema>;
export type MessagesModule = z.output<typeof messagesModuleSchema>;
export type DocumentsModule = z.output<typeof documentsModuleSchema>;
export type EquipmentNeed = z.output<typeof equipmentNeedSchema>;
export type EquipmentModule = z.output<typeof equipmentModuleSchema>;
export type LocationModule = z.output<typeof locationModuleSchema>;
export type StaffModule = z.output<typeof staffModuleSchema>;
export type PricingModule = z.output<typeof pricingModuleSchema>;
export type Rate = z.output<typeof rateSchema>;
export type PriceOption = z.output<typeof priceOptionSchema>;
export type DepositModule = z.output<typeof depositModuleSchema>;
export type PaymentMethodsModule = z.output<typeof paymentMethodsModuleSchema>;
export type SessionsModule = z.output<typeof sessionsModuleSchema>;

export const MODULE_GROUPS = [
  { id: "reserve", label: "Réserver" },
  { id: "time", label: "Le temps" },
  { id: "money", label: "L'argent" },
  { id: "resources", label: "Les ressources" },
  { id: "exchanges", label: "Les échanges" },
] as const;
export type ModuleGroup = (typeof MODULE_GROUPS)[number]["id"];

export interface ModuleDefinition {
  /** Clé dans `modules`, ou identifiant d'un module « Bientôt ». */
  key: string;
  name: string;
  group: ModuleGroup;
  description: string;
  /** Mots en plus pour la recherche du catalogue. */
  keywords: string;
  /** Lot qui l'apporte, pour les modules pas encore disponibles. */
  soon?: string;
  /** Réglages d'un module qu'on vient d'ajouter. */
  defaults?: object;
}

/** Catalogue « Ajouter un module » (maquette 9.2), dans l'ordre d'affichage. */
export const MODULE_CATALOG: readonly ModuleDefinition[] = [
  {
    key: "places",
    name: "Places",
    group: "reserve",
    description: "Nombre de places, maximum par inscription, seuil de maintien.",
    keywords: "jauge capacité minimum annulé maintien",
    defaults: { capacity: 12 },
  },
  {
    key: "waitlist",
    name: "Liste d'attente",
    group: "reserve",
    description: "Quand c'est complet, la place libérée est proposée au suivant.",
    keywords: "complet attente",
    defaults: {},
  },
  {
    key: "approval",
    name: "Validation manuelle",
    group: "reserve",
    description: "Chaque demande attend ton accord avant d'être confirmée.",
    keywords: "accord demande valider",
    defaults: {},
  },
  {
    key: "opening",
    name: "Ouverture des inscriptions",
    group: "reserve",
    description: "Ouvre à J-30, ferme la veille, ou à une date fixe.",
    keywords: "date ouverture fermeture délai",
    defaults: { opensDaysBefore: 30, closesHoursBefore: 24 },
  },
  {
    key: "cancellation",
    name: "Annulation",
    group: "reserve",
    description: "Délai, remboursement : une règle propre au type.",
    keywords: "remboursement délai annuler",
    defaults: { freeHours: 48, lateRefundPercent: 0 },
  },
  {
    key: "access",
    name: "Conditions d'accès",
    group: "reserve",
    description: "Âge, réservé aux adhérents ou sur invitation.",
    keywords: "âge enfant mineur autorisation parentale adhérent étiquette invitation",
    defaults: { minAge: 12 },
  },
  {
    key: "sessions",
    name: "Plusieurs séances",
    group: "time",
    description: "Un stage sur trois samedis : une inscription, toutes les dates.",
    keywords: "stage dates",
    defaults: { sameEquipment: false },
  },
  {
    key: "series",
    name: "Inscription à la série",
    group: "time",
    description: "Au trimestre ou à l'année, avec un prix pour la série.",
    keywords: "trimestre année cours abonnement",
    defaults: { dropInAllowed: true, prorata: true, makeupAllowed: true },
  },
  {
    key: "slots",
    name: "Créneaux",
    group: "time",
    description: "Tu donnes tes disponibilités, l'élève choisit son créneau.",
    keywords: "rendez-vous disponibilités",
    defaults: {
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
  },
  {
    key: "duration",
    name: "Durée au choix",
    group: "time",
    description: "1 h, 2 h ou la journée : chaque durée a son prix.",
    keywords: "location heure journée",
    defaults: {
      options: [
        { id: "1h", label: "1 h", minutes: 60, priceCents: 4500, description: "Découverte" },
        { id: "2h", label: "2 h", minutes: 120, priceCents: 8000 },
        { id: "journee", label: "Journée", minutes: 360, priceCents: 18000 },
      ],
      defaultId: "1h",
    },
  },
  {
    key: "pricing",
    name: "Tarifs et options",
    group: "money",
    description: "Plusieurs tarifs, options payantes.",
    keywords: "prix réduit étudiant enfant option supplément",
    defaults: {
      rates: [
        { id: "plein", name: "Plein", priceCents: 4500 },
        {
          id: "reduit",
          name: "Réduit",
          priceCents: 3500,
          description: "étudiant, demandeur d'emploi",
        },
      ],
      options: [],
    },
  },
  {
    key: "deposit",
    name: "Acompte",
    group: "money",
    description: "Une part à l'inscription, le reste sur place.",
    keywords: "arrhes paiement",
    defaults: { percent: 30, balance: "on_site" },
  },
  {
    key: "payment_methods",
    name: "Moyens acceptés",
    group: "money",
    description: "Cartes de séances et bons cadeaux valables ici.",
    keywords: "carte bon cadeau paiement",
    defaults: {},
  },
  {
    key: "equipment",
    name: "Matériel avancé",
    group: "resources",
    description: "Ce qu'il faut par place, qui le choisit.",
    keywords: "matériel tour tablier",
    defaults: { needs: [] },
  },
  {
    key: "location",
    name: "Lieu",
    group: "resources",
    description: "À l'atelier, en ligne, ou chez le client.",
    keywords: "adresse visio domicile",
    defaults: { mode: "venue" },
  },
  {
    key: "staff",
    name: "Intervenant",
    group: "resources",
    description: "Un membre de l'équipe par séance, au choix de l'élève ou non.",
    keywords: "professeur animateur équipe",
    defaults: { showOnPublicPage: true },
  },
  {
    key: "messages",
    name: "Messages",
    group: "exchanges",
    description: "Confirmation, rappel, après la séance.",
    keywords: "e-mail rappel à apporter",
    defaults: {},
  },
  {
    key: "documents",
    name: "Documents joints",
    group: "exchanges",
    description: "Règlement, plan d'accès en PDF dans la confirmation.",
    keywords: "pdf règlement plan autorisation parentale",
    defaults: { files: [] },
  },
];

export const isModuleKey = (key: string): key is ModuleKey => key in MODULE_SCHEMAS;

/**
 * Formules d'Horaya (décision de Moh du 2026-11-07, « l'équilibre entre l'éthique et la
 * rentabilité ») : on paie pour des besoins de pro (marque blanche, équipe, volume), jamais pour
 * récupérer ses données ni pour qu'un client puisse réserver. Depuis le 2026-11-09, on limite en
 * quantité plutôt qu'en fonctionnalités : comptoir pour tous, matériel plafonné en Libre.
 */
export const PLAN_IDS = ["libre", "pro", "equipe"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Fonctionnalités réservées aux formules payantes. */
export const PLAN_FEATURES = ["whiteLabel"] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export interface Plan {
  id: PlanId;
  name: string;
  /** Prix TTC en centimes ; l'annuel offre deux mois. */
  priceCents: Record<BillingInterval, number>;
  /**
   * `null` : illimité. Les réservations sont un quota souple (jamais refusées au client) ;
   * les exemplaires de matériel (hors retirés) bloquent l'ajout, jamais l'existant.
   */
  limits: {
    members: number | null;
    bookingsPerMonth: number | null;
    inventoryUnits: number | null;
  };
  features: readonly PlanFeature[];
}

export const PLANS: Record<PlanId, Plan> = {
  libre: {
    id: "libre",
    name: "Libre",
    priceCents: { month: 0, year: 0 },
    limits: { members: 1, bookingsPerMonth: 100, inventoryUnits: 5 },
    features: [],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceCents: { month: 1500, year: 15000 },
    limits: { members: 3, bookingsPerMonth: 1000, inventoryUnits: null },
    features: ["whiteLabel"],
  },
  equipe: {
    id: "equipe",
    name: "Équipe",
    priceCents: { month: 2900, year: 29000 },
    limits: { members: null, bookingsPerMonth: null, inventoryUnits: null },
    features: ["whiteLabel"],
  },
};

/** Ordre des formules : la plus haute disponible l'emporte. */
export const PLAN_RANK: Record<PlanId, number> = { libre: 0, pro: 1, equipe: 2 };

/** Essai de Pro offert à la création d'un espace, sans carte bancaire. */
export const TRIAL_DAYS = 14;

/**
 * Tarif appliqué au paiement : solidaire (−50 % pour les associations et petites structures),
 * bêta (prix bloqué des bêta-testeurs). Les remises elles-mêmes sont réglées chez Polar.
 */
export const BILLING_RATES = ["standard", "solidaire", "beta"] as const;
export type BillingRate = (typeof BILLING_RATES)[number];

/** Licences : formule offerte (essai, bêta-testeur, geste), avec ou sans fin. */
export const PLAN_GRANT_KINDS = ["trial", "beta", "gift"] as const;
export type PlanGrantKind = (typeof PLAN_GRANT_KINDS)[number];

export const SUBSCRIPTION_STATUSES = ["active", "past_due", "canceled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

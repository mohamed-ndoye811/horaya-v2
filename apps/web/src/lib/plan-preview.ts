/**
 * « Voir en tant que » (postes de développement seulement) : situations de facturation qu'on
 * applique à l'espace pour vérifier les écrans et les limites.
 */
export const PLAN_PREVIEWS = {
  libre: "Libre",
  quota: "Libre, quota dépassé",
  quota2: "Libre, 2 mois dépassés",
  essai: "Essai Pro",
  bt: "Bêta-testeur",
  solidaire: "Pro solidaire",
  pro: "Pro abonné",
  equipe: "Équipe annuel",
  impaye: "Pro impayé",
  resilie: "Pro résilié",
} as const;

export type PlanPreview = keyof typeof PLAN_PREVIEWS;

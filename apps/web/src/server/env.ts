import { z } from "zod";
import { POSTES } from "./poste";

const optional = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const schema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET : 32 caractères minimum"),
  BETTER_AUTH_URL: z.url(),
  SMTP_URL: optional,
  MAIL_FROM: z.string().default("Horaya <bonjour@horaya.app>"),
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  /** Envoi de fichiers : bucket Backblaze B2 privé (API S3) ; sans clés, l'envoi est désactivé. */
  STORAGE_ENDPOINT: optional,
  STORAGE_REGION: optional,
  STORAGE_BUCKET: optional,
  STORAGE_ACCESS_KEY_ID: optional,
  STORAGE_SECRET_ACCESS_KEY: optional,
  /** Clés de la plateforme Stripe Connect (Horaya) ; sans elles, passerelle de test. */
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  /** « 1 » : passerelle de test (/paiement-test) sans clés Stripe, pour le développement. */
  PAYMENTS_TEST_GATEWAY: optional,
  /**
   * Abonnements Horaya chez Polar (lot 24) : jeton d'accès, secret des webhooks, produits
   * (une formule × une période) et remises (tarif solidaire, prix bloqué des bêta-testeurs).
   * Sans jeton : paiement simulé en local, indisponible ailleurs.
   */
  POLAR_ACCESS_TOKEN: optional,
  POLAR_WEBHOOK_SECRET: optional,
  POLAR_SERVER: z.enum(["production", "sandbox"]).default("production"),
  POLAR_PRODUCT_PRO_MONTH: optional,
  POLAR_PRODUCT_PRO_YEAR: optional,
  POLAR_PRODUCT_EQUIPE_MONTH: optional,
  POLAR_PRODUCT_EQUIPE_YEAR: optional,
  POLAR_DISCOUNT_SOLIDAIRE: optional,
  POLAR_DISCOUNT_BETA: optional,
  /** Équipe Horaya : e-mails (séparés par des virgules) qui ont accès au cockpit de la plateforme. */
  PLATFORM_ADMINS: optional,
  /** Suivi des erreurs (GlitchTip, compatible Sentry) ; sans DSN, rien n'est envoyé. */
  SENTRY_DSN: optional,
  SENTRY_ENVIRONMENT: z.string().default("production"),
  /** Poste de travail local (worktree) : voir « Postes de travail » dans CLAUDE.md. */
  POSTE: z.enum(POSTES).optional(),
});

/** Variables d'environnement serveur, validées au démarrage. Ne jamais importer côté client. */
export const env = schema.parse(process.env);

export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

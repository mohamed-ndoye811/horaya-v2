import { z } from "zod";

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
  /** Clés de la plateforme Stripe Connect (Horaya) ; sans elles, passerelle de test. */
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  /** « 1 » : passerelle de test (/paiement-test) sans clés Stripe, pour le développement. */
  PAYMENTS_TEST_GATEWAY: optional,
});

/** Variables d'environnement serveur, validées au démarrage. Ne jamais importer côté client. */
export const env = schema.parse(process.env);

export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

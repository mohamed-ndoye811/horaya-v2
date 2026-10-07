import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import {
  assertAcceptablePassword,
  MEMBER_ROLE_LABELS,
  type MemberRole,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  ValidationError,
} from "@horaya/core";
import { type Db, schema, tenantSettingsRepository } from "@horaya/db";
import {
  emailVerificationEmail,
  invitationEmail,
  type Mailer,
  passwordResetEmail,
} from "@horaya/mail";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { asc, eq } from "drizzle-orm";
import { ac, roles } from "./permissions";

export interface AuthOptions {
  /** URL publique de l'app (ex. https://horaya.app), utilisée dans les liens d'e-mails. */
  baseURL: string;
  secret: string;
  mailer: Mailer;
  /** Connexion Google : activée seulement si les identifiants sont fournis. */
  google?: { clientId: string; clientSecret: string } | undefined;
}

/** Les champs additionnels ne sont pas typés dans les callbacks d'e-mail. */
const firstNameOf = (user: object) =>
  "firstName" in user && typeof user.firstName === "string" ? user.firstName : null;

/** Routes Better Auth qui reçoivent un nouveau mot de passe, et le champ qui le porte. */
const PASSWORD_FIELDS: Record<string, string> = {
  "/sign-up/email": "password",
  "/reset-password": "newPassword",
  "/change-password": "newPassword",
};

/**
 * Configuration Better Auth partagée par l'app web et la future API publique.
 * Un tenant = une organisation ; ses réglages vivent dans `tenant_settings`.
 */
export function createAuth(db: Db, options: AuthOptions) {
  const { mailer, google } = options;
  const tenantSettings = tenantSettingsRepository(db);

  return betterAuth({
    appName: "Horaya",
    baseURL: options.baseURL,
    secret: options.secret,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    user: {
      additionalFields: {
        firstName: { type: "string", required: false },
        lastName: { type: "string", required: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await mailer.send(user.email, passwordResetEmail({ firstName: firstNameOf(user), url }));
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 24 * 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await mailer.send(
          user.email,
          emailVerificationEmail({ firstName: firstNameOf(user), url }),
        );
      },
    },
    socialProviders: google
      ? {
          google: {
            clientId: google.clientId,
            clientSecret: google.clientSecret,
            mapProfileToUser: (profile) => ({
              firstName: profile.given_name,
              lastName: profile.family_name,
            }),
          },
        }
      : {},
    account: {
      // Un compte créé par e-mail peut ensuite se connecter avec Google (même adresse vérifiée).
      accountLinking: { enabled: true, trustedProviders: ["google"] },
    },
    databaseHooks: {
      session: {
        create: {
          // À la connexion, on ouvre directement le premier espace du membre.
          before: async (session) => {
            const [membership] = await db
              .select({ organizationId: schema.member.organizationId })
              .from(schema.member)
              .where(eq(schema.member.userId, session.userId))
              .orderBy(asc(schema.member.createdAt))
              .limit(1);
            return {
              data: { ...session, activeOrganizationId: membership?.organizationId ?? null },
            };
          },
        },
      },
    },
    hooks: {
      // Même politique de mot de passe partout, y compris via les routes HTTP de Better Auth.
      before: createAuthMiddleware(async (ctx) => {
        const field = PASSWORD_FIELDS[ctx.path];
        if (!field) return;
        const password = (ctx.body as Record<string, unknown> | undefined)?.[field];
        try {
          assertAcceptablePassword(typeof password === "string" ? password : "");
        } catch (error) {
          if (!(error instanceof ValidationError)) throw error;
          const missing = error.issues.map((issue) => issue.message.toLowerCase()).join(", ");
          throw new APIError("BAD_REQUEST", {
            code: "WEAK_PASSWORD",
            message: missing ? `Mot de passe trop faible : ${missing}.` : error.message,
          });
        }
      }),
    },
    plugins: [
      organization({
        ac,
        roles,
        creatorRole: "owner",
        invitationExpiresIn: 7 * 24 * 60 * 60,
        sendInvitationEmail: async ({ email, role, organization: org, inviter, id }) => {
          await mailer.send(
            email,
            invitationEmail({
              organizationName: org.name,
              inviterName: inviter.user.name,
              roleLabel: MEMBER_ROLE_LABELS[role as MemberRole] ?? role,
              url: new URL(`/invitation/${id}`, options.baseURL).toString(),
            }),
          );
        },
        organizationHooks: {
          afterCreateOrganization: async ({ organization: org }) => {
            await tenantSettings.ensureExists(org.id);
          },
        },
      }),
      // Doit rester le dernier plugin : pose les cookies depuis les Server Actions Next.js.
      nextCookies(),
    ],
    advanced: {
      database: { generateId: "uuid" },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

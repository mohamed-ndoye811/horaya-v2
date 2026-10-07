import { randomUUID } from "node:crypto";
import { createDb, schema } from "@horaya/db";
import type { EmailContent, Mailer } from "@horaya/mail";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../src/auth";

const db = createDb(process.env.TEST_DATABASE_URL ?? "");
afterAll(() => db.$client.end());

let sent: Array<{ to: string } & EmailContent>;
const mailer: Mailer = {
  async send(to, content) {
    sent.push({ to, ...content });
  },
};

const auth = createAuth(db, {
  baseURL: "http://localhost:3000",
  secret: "test-secret-test-secret-test-secret",
  mailer,
});

const PASSWORD = "Planifie-Avec-2026";

beforeEach(() => {
  sent = [];
});

/** Transforme les Set-Cookie d'une réponse en en-tête Cookie pour l'appel suivant. */
function cookieHeaders(responseHeaders: Headers): Headers {
  const cookie = responseHeaders
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

async function signUp() {
  const email = `camille.${randomUUID().slice(0, 8)}@test.dev`;
  const { headers } = await auth.api.signUpEmail({
    body: {
      name: "Camille Roux",
      firstName: "Camille",
      lastName: "Roux",
      email,
      password: PASSWORD,
    },
    returnHeaders: true,
  });
  return { email, headers: cookieHeaders(headers) };
}

describe("politique de mot de passe", () => {
  it("refuse un mot de passe long mais sans majuscule ni chiffre", async () => {
    await expect(
      auth.api.signUpEmail({
        body: { name: "Test", email: "faible@test.dev", password: "motdepassesimple" },
      }),
    ).rejects.toMatchObject({ body: { code: "WEAK_PASSWORD" } });
  });
});

describe("inscription et espace", () => {
  it("envoie l'e-mail de confirmation à l'inscription", async () => {
    const { email } = await signUp();
    expect(sent.map((mail) => [mail.to, mail.subject])).toEqual([
      [email, "Confirme ton adresse e-mail"],
    ]);
  });

  it("crée l'espace avec le créateur en propriétaire et des réglages par défaut", async () => {
    const { headers } = await signUp();
    const slug = `cabinet-${randomUUID().slice(0, 8)}`;
    const organization = await auth.api.createOrganization({
      body: { name: "Cabinet Vidal", slug },
      headers,
    });
    if (!organization) throw new Error("Organisation non créée");

    const [membership] = await db
      .select({ role: schema.member.role })
      .from(schema.member)
      .where(eq(schema.member.organizationId, organization.id));
    expect(membership?.role).toBe("owner");

    const [settings] = await db
      .select()
      .from(schema.tenantSettings)
      .where(eq(schema.tenantSettings.organizationId, organization.id));
    expect(settings?.timezone).toBe("Europe/Paris");

    const session = await auth.api.getSession({ headers });
    expect(session?.session.activeOrganizationId).toBe(organization.id);
  });

  it("rouvre le premier espace du membre à la connexion suivante", async () => {
    const { email, headers } = await signUp();
    const organization = await auth.api.createOrganization({
      body: { name: "Atelier Roux", slug: `atelier-${randomUUID().slice(0, 8)}` },
      headers,
    });

    const { headers: signInHeaders } = await auth.api.signInEmail({
      body: { email, password: PASSWORD },
      returnHeaders: true,
    });
    const session = await auth.api.getSession({ headers: cookieHeaders(signInHeaders) });
    expect(session?.session.activeOrganizationId).toBe(organization?.id);
  });
});

describe("mot de passe oublié", () => {
  it("envoie un lien valable vers la page de réinitialisation", async () => {
    const { email } = await signUp();
    sent = [];
    await auth.api.requestPasswordReset({ body: { email, redirectTo: "/nouveau-mot-de-passe" } });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.subject).toBe("Choisis un nouveau mot de passe");
    expect(sent[0]?.text).toMatch(
      /\/api\/auth\/reset-password\/\S+\?callbackURL=%2Fnouveau-mot-de-passe/,
    );
  });

  it("ne révèle pas si l'adresse existe", async () => {
    const response = await auth.api.requestPasswordReset({
      body: { email: "inconnu@test.dev", redirectTo: "/nouveau-mot-de-passe" },
    });
    expect(response.status).toBe(true);
    expect(sent).toHaveLength(0);
  });
});

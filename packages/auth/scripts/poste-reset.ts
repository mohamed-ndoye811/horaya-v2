/**
 * Repart d'une base neuve pour le poste courant (lot ou fix) : supprime et recrée la base de
 * DATABASE_URL, applique les migrations, crée un compte et un espace de démo, puis le remplit.
 *
 *   pnpm poste:reset
 *
 * Ne touche qu'à la base de DATABASE_URL, en local seulement. Refusé dans le poste integration.
 */
import { execFileSync } from "node:child_process";
import { createDb, schema } from "@horaya/db";
import { eq } from "drizzle-orm";
import { createAuth } from "../src/auth";

const DEMO = {
  email: "demo@horaya.local",
  password: "Demo-Horaya-2026",
  name: "Camille Démo",
  firstName: "Camille",
  lastName: "Démo",
  organization: "Studio Démo",
  slug: "demo",
};
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

function fail(message: string): never {
  console.error(`poste:reset — ${message}`);
  process.exit(1);
}

const poste = process.env.POSTE;
if (poste !== "lot" && poste !== "fix") {
  fail(
    `réservé aux postes lot et fix (POSTE=${poste ?? "absent"}). ` +
      "La base du poste integration ne se réinitialise jamais par script.",
  );
}
const databaseUrl = process.env.DATABASE_URL ?? fail("DATABASE_URL manquant dans le .env");
const secret = process.env.BETTER_AUTH_SECRET ?? fail("BETTER_AUTH_SECRET manquant dans le .env");

const url = new URL(databaseUrl);
if (!LOCAL_HOSTS.includes(url.hostname)) {
  fail(`DATABASE_URL doit pointer vers une base locale (hôte actuel : ${url.hostname}).`);
}
const database = decodeURIComponent(url.pathname.slice(1));
if (!/^\w+$/.test(database) || ["horaya", "postgres"].includes(database)) {
  fail(`nom de base refusé : « ${database} » (attendu par exemple horaya_${poste}).`);
}

// 1. Base neuve, via une connexion d'administration sur la base « postgres ».
const adminUrl = new URL(url);
adminUrl.pathname = "/postgres";
const admin = createDb(adminUrl.toString(), { maxConnections: 1 });
await admin.$client.unsafe("SET client_min_messages = warning");
await admin.$client.unsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
await admin.$client.unsafe(`CREATE DATABASE "${database}"`);
await admin.$client.end();
console.info(`Base « ${database} » recréée.`);

// 2. Migrations : mêmes scripts que d'habitude (ils lisent le .env de ce poste).
const db = (...args: string[]) =>
  execFileSync("pnpm", ["--filter", "@horaya/db", ...args], { stdio: "inherit" });
db("migrate");

// 3. Compte et espace de démo, en passant par Better Auth (mêmes hooks que l'inscription).
const client = createDb(databaseUrl, { maxConnections: 2 });
const auth = createAuth(client, {
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost",
  secret,
  mailer: { async send() {} },
});
const { headers } = await auth.api.signUpEmail({
  body: {
    name: DEMO.name,
    firstName: DEMO.firstName,
    lastName: DEMO.lastName,
    email: DEMO.email,
    password: DEMO.password,
  },
  returnHeaders: true,
});
await client
  .update(schema.user)
  .set({ emailVerified: true })
  .where(eq(schema.user.email, DEMO.email));
const cookie = headers
  .getSetCookie()
  .map((line) => line.split(";")[0])
  .join("; ");
await auth.api.createOrganization({
  body: { name: DEMO.organization, slug: DEMO.slug },
  headers: new Headers({ cookie }),
});
await client.$client.end();

// 4. Données des maquettes.
db("seed-demo", DEMO.slug);

console.info(`\nPoste ${poste} prêt. Compte démo : ${DEMO.email} / ${DEMO.password}`);

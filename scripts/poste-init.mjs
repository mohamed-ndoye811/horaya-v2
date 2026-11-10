/**
 * Crée un poste de travail (worktree permanent) à côté du poste integration :
 * ../horaya-<poste>, détaché sur origin/develop, avec son .env (port, base, cookies),
 * ses dépendances et une base de démo neuve.
 *
 *   pnpm poste:init <lot|fix>
 *
 * À lancer depuis le poste integration. Ne fait rien si le dossier existe déjà.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadEnvFile } from "node:process";

const PORTS = { lot: 3101, fix: 3102 };

function fail(message) {
  console.error(`poste:init — ${message}`);
  process.exit(1);
}

const poste = process.argv[2];
if (!(poste in PORTS)) fail("usage : pnpm poste:init <lot|fix>");

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const root = git("rev-parse", "--show-toplevel");
const envPath = join(root, ".env");
if (!existsSync(envPath)) fail(`pas de .env dans ${root}`);
// Les commandes lancées dans le nouveau poste lisent son .env : elles ne doivent pas hériter
// de celui d'integration (tsx --env-file n'écrase pas une variable déjà définie).
const childEnv = { ...process.env };
loadEnvFile(envPath);
if (process.env.POSTE !== "integration") {
  fail(`à lancer depuis le poste integration (POSTE=${process.env.POSTE ?? "absent"} ici).`);
}

const target = resolve(dirname(root), `horaya-${poste}`);
if (existsSync(target)) {
  console.info(`Le poste ${poste} existe déjà : ${target}. Rien à faire.`);
  process.exit(0);
}

console.info(`Création du poste ${poste} dans ${target}…`);
execFileSync("git", ["fetch", "origin", "develop"], { stdio: "inherit" });
execFileSync("git", ["worktree", "add", "--detach", target, "origin/develop"], {
  stdio: "inherit",
});

// .env du poste : copie de celui d'integration, avec son port, sa base et son poste.
const port = PORTS[poste];
const databaseUrl = new URL(process.env.DATABASE_URL ?? fail("DATABASE_URL manquant"));
databaseUrl.pathname = `/${databaseUrl.pathname.slice(1)}_${poste}`;
const values = {
  POSTE: poste,
  PORT: String(port),
  DATABASE_URL: databaseUrl.toString(),
  BETTER_AUTH_URL: `http://localhost:${port}`,
};
let env = readFileSync(envPath, "utf8");
for (const [key, value] of Object.entries(values)) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  env = pattern.test(env) ? env.replace(pattern, line) : `${env.trimEnd()}\n${line}\n`;
}
writeFileSync(join(target, ".env"), env);

execFileSync("pnpm", ["install"], { cwd: target, stdio: "inherit", env: childEnv });
execFileSync("pnpm", ["poste:reset"], { cwd: target, stdio: "inherit", env: childEnv });

console.info(`
Poste ${poste} prêt : ${target}
  cd ${target} && pnpm dev        → http://localhost:${port}
  puis : git switch -c ${poste}/<sujet> origin/develop`);

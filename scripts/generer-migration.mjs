/**
 * Génère une migration Drizzle (pnpm db:generate), seulement depuis le poste lot et sur une
 * branche à jour de origin/develop : deux migrations générées en parallèle prendraient le même
 * numéro. Les arguments sont transmis à drizzle-kit (ex. --name ajout_factures).
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { loadEnvFile } from "node:process";

function fail(message) {
  console.error(`db:generate — ${message}`);
  process.exit(1);
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const root = git("rev-parse", "--show-toplevel");
try {
  loadEnvFile(join(root, ".env"));
} catch {
  // Sans .env, POSTE est absent : refusé plus bas.
}

if (process.env.POSTE !== "lot") {
  fail(
    `les migrations se génèrent uniquement dans le poste lot (POSTE=${process.env.POSTE ?? "absent"} ici).\n` +
      "  En poste fix : arrête-toi et signale qu'un changement de schéma est nécessaire.",
  );
}

execFileSync("git", ["fetch", "--quiet", "origin", "develop"], { stdio: "inherit" });
try {
  execFileSync("git", ["merge-base", "--is-ancestor", "origin/develop", "HEAD"]);
} catch {
  fail("ta branche n'est pas à jour : fais `git rebase origin/develop`, puis `pnpm db:migrate`.");
}

execFileSync("pnpm", ["--filter", "@horaya/db", "generate", ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
});

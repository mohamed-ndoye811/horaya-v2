/**
 * `pnpm dev` : `next dev` lit PORT avant de charger next.config.ts. On charge donc le .env
 * racine du poste avant de le lancer, pour que chaque poste démarre sur son port.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

try {
  loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch {
  // Pas de .env : variables de l'environnement.
}

const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [next, "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 0));

import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

// Monorepo : les variables d'environnement vivent dans le .env à la racine du poste.
try {
  loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // Pas de .env (CI, production) : les variables viennent de l'environnement.
}

/** En local, chaque poste a son port (3100, 3101, 3102 : voir « Postes de travail »). */
const port = Number(process.env.PORT ?? 3100);

export default defineConfig({
  // Toutes les interfaces, comme l'ancien serveur Next : localhost répond en IPv4 et en IPv6.
  server: { port, strictPort: true, host: true },
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), viteReact(), nitro()],
});

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

/**
 * Migration en cours : Next garde le PORT du poste (3100, 3101, 3102), TanStack Start tourne
 * sur PORT + 10. En local, Better Auth prend cette adresse (même préfixe de cookies : la
 * session est partagée avec l'app Next du poste).
 */
const devPort = Number(process.env.START_PORT ?? Number(process.env.PORT ?? 3100) + 10);

export default defineConfig(({ command }) => {
  if (command === "serve") {
    // Nitro et Start lisent PORT : sans ça, le serveur de dev prendrait celui de Next.
    process.env.PORT = String(devPort);
    process.env.BETTER_AUTH_URL = `http://localhost:${devPort}`;
  }
  return {
    server: { port: devPort, strictPort: true },
    resolve: { tsconfigPaths: true },
    plugins: [tailwindcss(), tanstackStart(), viteReact(), nitro()],
  };
});

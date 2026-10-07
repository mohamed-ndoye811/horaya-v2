import path from "node:path";
import type { NextConfig } from "next";

// Monorepo : les variables d'environnement vivent dans le .env à la racine du dépôt.
try {
  process.loadEnvFile(path.resolve(process.cwd(), "../../.env"));
} catch {
  // Pas de .env (CI, production) : les variables viennent de l'environnement.
}

const nextConfig: NextConfig = {
  // Pas de badge Next.js en bas de l'écran : les captures pour le vault restent propres.
  devIndicators: false,
};

export default nextConfig;

import path from "node:path";
import type { NextConfig } from "next";

// Monorepo : les variables d'environnement vivent dans le .env à la racine du dépôt.
try {
  process.loadEnvFile(path.resolve(process.cwd(), "../../.env"));
} catch {
  // Pas de .env (CI, production) : les variables viennent de l'environnement.
}

const nextConfig: NextConfig = {};

export default nextConfig;

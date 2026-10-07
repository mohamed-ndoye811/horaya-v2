import path from "node:path";
import type { NextConfig } from "next";

// Monorepo : les variables d'environnement vivent dans le .env à la racine du dépôt.
try {
  process.loadEnvFile(path.resolve(process.cwd(), "../../.env"));
} catch {
  // Pas de .env (CI, production) : les variables viennent de l'environnement.
}

/** En-têtes de sécurité de toutes les pages (HSTS et TLS sont gérés par Cloudflare et l'ingress). */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  // Pas de badge Next.js en bas de l'écran : les captures pour le vault restent propres.
  devIndicators: false,
  // Image Docker légère : seuls les fichiers utiles au serveur, traçés depuis la racine du monorepo.
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

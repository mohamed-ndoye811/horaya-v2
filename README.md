# Horaya

Réservations, événements et matériel dans un seul agenda, sous la marque de l'organisateur.

## Architecture

```
packages/
  core/   Métier pur : entités, règles, cas d'usage, ports (interfaces de dépôt).
          Aucune dépendance à Next.js, Hono ou Postgres. Validation avec Zod.
  db/     Postgres + Drizzle : schéma, migrations, implémentation des ports du core.
apps/
  web/    Next.js (App Router) : admin + pages publiques des organisateurs.
          Appelle directement les cas d'usage du core côté serveur, jamais l'API HTTP.
  api/    (à venir) Hono : API publique pour les intégrateurs et futures apps
          mobiles / logicielles. Même core derrière.
```

Règles :

- Le **core** ne dépend de rien d'autre que de lui-même (et de Zod).
- Les **portes d'entrée** (web, api) traduisent les erreurs du core (`DomainError`) dans leur format.
- Code organisé **par module** : `tenants`, `events`, `bookings`, `customers`, `inventory`, `settings`.
- Multi-tenant par chemin : `horaya.app/<slug>`.

## Démarrer

Prérequis : Node 22+, pnpm 9, Docker.

```bash
pnpm install
cp .env.example .env
pnpm db:up          # Postgres 16 en local
pnpm db:migrate     # applique les migrations
pnpm dev            # http://localhost:3000
```

## Scripts

| Script | Rôle |
|---|---|
| `pnpm dev` | App web en développement |
| `pnpm build` | Build de tous les packages |
| `pnpm typecheck` | Vérification TypeScript |
| `pnpm test` | Tests (Vitest) |
| `pnpm lint` / `pnpm format` | Biome |
| `pnpm db:generate` | Génère une migration depuis le schéma Drizzle |
| `pnpm db:migrate` | Applique les migrations |
| `pnpm db:studio` | Drizzle Studio |

## Design

Maquettes et tokens dans le fichier Paper **HORAYA** (pages 00 à 05). Les tokens
(couleurs, typo) sont reportés dans `apps/web/src/app/globals.css`.

Polices, toutes Google Fonts (libres de droits), chargées via `next/font` :

- **Archivo** (variable, axe de largeur) pour les titres. Remplace Sztos des maquettes.
  Utilitaires : `font-headline` (gros titres) et `font-section` (en-têtes de section).
- **Urbanist** pour l'interface.
- **Geist Mono** pour les labels et les données.

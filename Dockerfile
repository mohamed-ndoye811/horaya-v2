# syntax=docker/dockerfile:1.7
# Images de production d'Horaya :
#   --target web      serveur Next.js (sortie « standalone »)
#   --target migrate  migrations Drizzle, lancées avant le serveur (initContainer)

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# Dépendances seules (couche mise en cache tant que les package.json ne bougent pas).
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/auth/package.json packages/auth/
COPY packages/mail/package.json packages/mail/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Valeurs factices pour la compilation : les vraies arrivent à l'exécution (ConfigMap + Secret).
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-only-secret-not-used-at-runtime-0000 \
    BETTER_AUTH_URL=https://build.invalid \
    pnpm --filter web build

# Migrations : uniquement le paquet db et ses dépendances de production.
FROM build AS migrate-bundle
RUN pnpm --filter @horaya/db deploy --prod /out

FROM node:22-alpine AS migrate
WORKDIR /app
COPY --from=migrate-bundle /out ./
USER node
CMD ["node", "--import", "tsx", "src/migrate.ts"]

FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# 🎉 Configuration complète - Horaya v2

## 📦 Stack technique

### Backend
- **Runtime**: Bun
- **Framework API**: Hono
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL 16
- **Architecture**: DDD + Effect
- **Documentation API**: Scalar (OpenAPI 3.0)

### Frontend (à venir)
- **Framework**: Astro
- **UI**: React + Tailwind

## 🚀 Démarrage rapide

### 1. Démarrer la base de données
```bash
docker compose up -d
```

### 2. Appliquer les migrations
```bash
cd packages/infrastructure
pnpm run db:migrate
```

### 3. Lancer l'API
```bash
cd apps/rest-api
pnpm run dev
```

L'API est disponible sur: `http://localhost:3000`

### 4. Accéder à la documentation
Ouvrez votre navigateur: `http://localhost:3000/docs`

Interface Scalar avec:
- Documentation interactive
- Test des endpoints
- Exemples de requêtes
- Schémas détaillés

## 📚 Documentation disponible

- **DATABASE.md** - Guide d'utilisation de PostgreSQL
- **DRIZZLE.md** - Guide Drizzle ORM et migrations
- Ce fichier - Vue d'ensemble

## 🛠️ Commandes utiles

### Base de données
```bash
# Démarrer PostgreSQL
docker compose up -d

# Arrêter PostgreSQL
docker compose stop

# Tout supprimer (données incluses)
docker compose down -v

# Se connecter à la base
docker compose exec postgres psql -U user -d horaya
```

### Migrations
```bash
cd packages/infrastructure

# Générer une migration après modification du schéma
pnpm run db:generate

# Appliquer les migrations
pnpm run db:migrate

# Push direct (dev uniquement)
pnpm run db:push

# Interface visuelle Drizzle Studio
pnpm run db:studio
```

### API REST
```bash
cd apps/rest-api

# Développement
pnpm run dev

# TypeCheck
pnpm typecheck

# Voir les logs
# (les logs s'affichent dans le terminal)
```

## 🧪 Tester l'API

### Créer un événement
```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174001",
    "title": "Concert de Jazz",
    "start": "2024-12-25T20:00:00Z",
    "end": "2024-12-25T23:00:00Z",
    "capacity": 100,
    "description": "Un magnifique concert de jazz"
  }'
```

### Lister les événements
```bash
curl http://localhost:3000/events
```

## 📁 Structure du projet

```
horaya-v2/
├── apps/
│   └── rest-api/              # API REST Hono
│       ├── src/
│       │   ├── index.ts       # Point d'entrée + config Scalar
│       │   ├── routes/        # Définition des routes OpenAPI
│       │   └── mappers/       # Conversion entités -> API
│       └── package.json
│
├── packages/
│   ├── domain/                # Logique métier (DDD)
│   │   ├── event/
│   │   ├── event-type/
│   │   └── shared/
│   │
│   ├── application/           # Use cases (Effect)
│   │   └── event/
│   │
│   └── infrastructure/        # Implémentation technique
│       ├── src/
│       │   ├── persistence/
│       │   │   └── postgres/
│       │   │       ├── schema.ts           # Schéma Drizzle
│       │   │       ├── PostgresDatabase.ts # Connexion DB
│       │   │       ├── repositories/       # Implémentation repos
│       │   │       └── mappers/           # DB <-> Domain
│       │   ├── config/
│       │   └── migrate.ts     # Script de migration
│       ├── drizzle/           # Fichiers de migration SQL
│       └── drizzle.config.ts  # Config Drizzle
│
├── docker-compose.yml         # PostgreSQL
├── .env                       # Variables d'environnement
└── pnpm-workspace.yaml        # Configuration monorepo
```

## 🎯 Prochaines étapes

### Backend
- [ ] Ajouter l'authentification
- [ ] Implémenter les bookings
- [ ] Ajouter la pagination
- [ ] Mettre en place les tests

### Frontend
- [ ] Configurer Astro
- [ ] Créer les pages principales
- [ ] Intégrer avec l'API REST
- [ ] Ajouter le design system

### DevOps
- [ ] CI/CD pipeline
- [ ] Environnements (staging, prod)
- [ ] Monitoring et logs
- [ ] Backups automatiques

## 💡 Tips

### Workflow de développement
1. Modifier le schéma dans `packages/infrastructure/src/persistence/postgres/schema.ts`
2. Générer la migration: `pnpm run db:generate`
3. Appliquer: `pnpm run db:migrate`
4. Les routes OpenAPI sont automatiquement documentées dans Scalar

### Ajouter une nouvelle route
1. Créer la route dans `apps/rest-api/src/routes/`
2. Utiliser `createRoute()` pour la définition OpenAPI
3. Utiliser `.openapi()` pour le handler
4. Monter la route dans `index.ts`
5. Elle apparaîtra automatiquement dans `/docs` !

### Debug
- Logs de l'API: dans le terminal où tourne `pnpm run dev`
- Logs PostgreSQL: `docker compose logs -f postgres`
- Explorer la DB: `pnpm run db:studio` ou `psql`

## 📞 Support

Pour toute question:
- Documentation OpenAPI: `/docs`
- Drizzle docs: https://orm.drizzle.team
- Hono docs: https://hono.dev
- Effect docs: https://effect.website

# Guide Drizzle ORM

## 🚀 Workflow de développement

### 1. Modifier le schéma
Éditez `packages/infrastructure/src/persistence/postgres/schema.ts`

```typescript
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  // ... ajoutez vos colonnes
});
```

### 2. Générer la migration
```bash
cd packages/infrastructure
pnpm run db:generate
```
Cela crée un fichier SQL dans `drizzle/`

### 3. Appliquer la migration
```bash
pnpm run db:migrate
```

### 4. Alternative: Push direct (dev uniquement)
Pour le développement rapide, vous pouvez pousser directement sans migration:
```bash
pnpm run db:push
```
⚠️ Ne pas utiliser en production !

## 🛠️ Commandes disponibles

| Commande | Description |
|----------|-------------|
| `pnpm run db:generate` | Génère les fichiers de migration SQL |
| `pnpm run db:migrate` | Applique les migrations sur la base |
| `pnpm run db:push` | Push direct du schéma (dev only) |
| `pnpm run db:studio` | Interface visuelle Drizzle Studio |

## 📊 Drizzle Studio

Interface web pour explorer vos données:
```bash
cd packages/infrastructure
pnpm run db:studio
```
Ouvre sur `https://local.drizzle.studio`

## 🔄 Migration vs Push

**Generate + Migrate** (Recommandé pour prod):
- Génère un historique de migrations
- Versionnage des changements
- Rollback possible
- Idéal pour CI/CD

**Push** (Dev rapide):
- Pas d'historique
- Détecte et applique les changements automatiquement
- Parfait pour le prototypage local

## 📝 Exemples

### Ajouter une colonne
```typescript
// schema.ts
export const events = pgTable('events', {
  // ... colonnes existantes
  status: varchar('status', { length: 50 }).notNull().default('draft'),
});
```

Puis: `pnpm run db:generate && pnpm run db:migrate`

### Ajouter une table
```typescript
export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id),
  // ... autres colonnes
});
```

### Ajouter un index
```typescript
import { index } from 'drizzle-orm/pg-core';

export const events = pgTable('events', {
  // ... colonnes
}, (table) => ({
  tenantIdx: index('tenant_idx').on(table.tenantId),
  startAtIdx: index('start_at_idx').on(table.startAt),
}));
```

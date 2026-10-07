# Horaya

Réservations, événements et matériel dans un seul agenda, sous la marque de l'organisateur.

## Architecture

```
packages/
  core/   Métier pur : entités, règles, cas d'usage, ports (interfaces de dépôt).
          Aucune dépendance à Next.js, Hono ou Postgres. Validation avec Zod.
  db/     Postgres + Drizzle : schéma, migrations, implémentation des ports du core.
  auth/   Better Auth : e-mail/mot de passe, Google, organisations = tenants,
          rôles owner / admin / editor / viewer (permissions.ts).
  mail/   E-mails transactionnels (gabarits + envoi SMTP).
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
cp .env.example .env   # puis renseigner BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm db:up             # Postgres 16 + Mailpit en local
pnpm db:migrate        # applique les migrations
pnpm dev               # http://localhost:3000
```

Les e-mails envoyés en local (confirmation, mot de passe oublié, invitations) arrivent dans
Mailpit : http://localhost:8025. La connexion Google s'active dès que `GOOGLE_CLIENT_ID` et
`GOOGLE_CLIENT_SECRET` sont renseignés (le bouton est masqué sinon).

## Parcours compte

| Route | Écran Paper |
|---|---|
| `/connexion` | 01 · Connexion — E-mail, puis 02 · Mot de passe |
| `/inscription` | 11 · Inscription |
| `/inscription/espace` | 12 · Création de l'espace (aperçu de la page publique en direct) |
| `/inscription/paiements` | Étape 3 : Stripe arrive avec les pages publiques, on peut passer |
| `/mot-de-passe-oublie` | 13 · Mot de passe oublié, puis 13b · Lien envoyé |
| `/nouveau-mot-de-passe` | 14 · Nouveau mot de passe (lien valable 30 min) |
| `/app` | Admin (protégé par `src/proxy.ts`) |
| `/<espace>` | 27 · Page publique de l'espace (événements à venir, filtres par type) |
| `/<espace>/<événement>` | 10 · Page publique d'un événement, puis `/reserver` : 18 · Coordonnées |
| `/<espace>/reservation/<jeton>` | 19 · Confirmation (`?nouvelle=1`) et « Gérer ma réservation » (annulation, `.ics`) |
| `/<espace>/mes-reservations` | Renvoi des liens de réservation par e-mail (pas de compte client) |
| `/invitation/[id]` | Rejoindre un espace depuis l'e-mail d'invitation (création de compte ou connexion avec `?invitation=`) |

Connexion, inscription et réinitialisation passent par `/api/auth` (client Better Auth) afin
de profiter de la limitation de tentatives. La politique de mot de passe (`checkPassword` du
core) est appliquée côté interface et dans un hook Better Auth.

## Scripts

| Script | Rôle |
|---|---|
| `pnpm dev` | App web en développement |
| `pnpm build` | Build de tous les packages |
| `pnpm typecheck` | Vérification TypeScript |
| `pnpm test` | Tests (Vitest). Ceux de `db` et `auth` créent une base `<base>_test_<package>` jetable |
| `pnpm lint` / `pnpm format` | Biome |
| `pnpm db:generate` | Génère une migration depuis le schéma Drizzle |
| `pnpm db:migrate` | Applique les migrations |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm db:seed-demo <adresse> [--reset]` | Remplit un espace avec les données des maquettes ; `--reset` le vide d'abord |
| `pnpm db:auth-schema` | Régénère `packages/db/src/schema/auth.ts` depuis la config Better Auth |

## Données

- Un **tenant** = une `organization` Better Auth ; ses réglages vivent dans `tenant_settings` (1:1).
- `packages/db/src/schema/auth.ts` est **généré** : ne pas l'éditer, relancer `pnpm db:auth-schema`.
- Les valeurs des enums Postgres viennent des constantes du core (source unique).
- Montants en centimes (entiers), dates en `timestamptz`, identifiants UUID v7.
- Règles garanties par la base, en plus du core :
  - un exemplaire de matériel n'est jamais alloué deux fois sur la même période
    (contrainte d'exclusion `item_allocation_no_overlap`, migration `0001`) ;
  - une réservation d'événement pointe toujours vers un événement, une location a une période valide ;
  - un client est unique par e-mail (insensible à la casse) dans un tenant.
- La surréservation est impossible : toute écriture qui touche aux places d'un événement
  (réservation, annulation, changement de jauge) passe par `lockForBooking`
  (`SELECT … FOR UPDATE`). Un test lance 12 réservations simultanées sur 5 places.
- Le matériel ne peut pas être prêté deux fois : chaque attribution verrouille l'article
  (`lockItem`, `FOR UPDATE`) et la contrainte d'exclusion refuse tout chevauchement restant
  (traduit en « exemplaire déjà pris »). Un test lance des attributions simultanées.

## Cas d'usage (core)

Fonctions pures de dépendances : `cas(deps, acteur, entrée)`. `deps` vient de
`createDeps(db)` (`packages/db`) ; l'acteur est un membre (rôle vérifié via
`ROLE_PERMISSIONS`), un client (page publique, lien « Gérer ma réservation ») ou le système.

| Module | Cas d'usage |
|---|---|
| Événements | `createEventType`, `updateEventType`, `archiveEventType`, `createEvent` (simple ou série), `updateEvent`, `publishEvent`, `cancelEvent` |
| Réservations | `createEventBooking`, `confirmBooking`, `refuseBooking`, `cancelBooking`, `cancelBookingWithToken` |
| Clients | `createCustomer`, `updateCustomer`, `addCustomerNote` |
| Paiements | `recordManualPayment`, `recordManualRefund` (paiement par lien), `connectPaymentAccount`, `refreshPaymentAccount`, `startCheckout`, `completeCheckout`, `expireCheckout`, `refundBooking`, `refundAfterCancellation` |
| Paramètres | `updateTenantSettings` (marque, TVA, acompte, annulation), `saveNotificationPreferences` (par membre) |
| Matériel | `createItem`, `updateItem`, `setItemQuantity`, `setEventItemQuantity`, `removeEventItem`, `scheduleMaintenance`, `cancelMaintenance`, `createRentalBooking` |

Paiements : par défaut, **lien de paiement externe** (celui de l'événement, sinon celui de
l'espace) ; l'équipe note les paiements et remboursements (« Marquer comme payé »). Le paiement
intégré Stripe Connect est prêt mais ne s'active qu'avec `STRIPE_SECRET_KEY` : chaque organisateur encaisse sur son propre compte (activé depuis
Paramètres › Paiements) ; le client paie tout ou l'acompte sur la page Stripe Checkout, le
webhook `/api/stripe/webhook` confirme le paiement (ou annule la réservation si la page expire)
et une annulation rembourse selon la politique de l'espace. Sans `STRIPE_SECRET_KEY`, une
passerelle de test simule Stripe (`/paiement-test`) si `PAYMENTS_TEST_GATEWAY=1`.

E-mails : `createDeps(db, { afterCommit })` reçoit, après chaque transaction validée, les
entrées du journal d'activité ; l'app web s'en sert pour écrire aux participants (validation,
refus, annulation, place libérée) et prévenir l'équipe selon ses préférences.

Règles notables : liste d'attente qui monte automatiquement (première demande qui tient),
réservation en ligne fermée sur invitation et après le délai minimum, saisie par l'équipe
confirmée d'office, matériel d'un événement qui suit ses changements de date et se libère
à l'annulation, location facturée à la journée entamée, séries qui gardent l'heure locale au changement d'heure, références
`PREFIXE-AAMM-NNNN` par tenant. Côté web : `deps` et `requireMember()` dans
`apps/web/src/server/services.ts`.

## Design system (admin)

Composants dans `apps/web/src/components/` (vitrine en direct : `/app/design-system`) :

| Dossier | Contenu |
|---|---|
| `app/` | `Sidebar` (colonne 232 px, tiroir sur mobile), `PageHeader` |
| `ui/` | `Button` / `IconButton` / `ButtonLink`, `StatusBadge` (+ `status.ts` : libellés des statuts métier), `Avatar`, `Stat` / `StatGrid`, `ProgressBar`, `DataTable`, cellules (`PersonCell`, `EventCell`, `DateBlock`, `MoneyCell`), `SearchInput`, `SegmentedLinks` / `SegmentedControl`, `ChoiceCards`, `Select`, `Field` / `AffixInput` / `Switch` / `Checkbox`, `Banner`, `Tabs`, `Timeline`, `Chip` / `ChoiceChips`, `Dialog`, `ActionMenu`, `EmptyState` |
| `calendar/` | `MonthCalendar`, `TimeGridCalendar` (semaine et jour), `CalendarLegend` |

Logique pure testée dans `apps/web/src/lib/` : formats français (`format.ts`), couleur de
texte lisible sur une couleur de catégorie (`colors.ts`), grilles et placement des
événements qui se chevauchent (`calendar.ts`).

Règle : pas de fusion de classes Tailwind. `className` sert à la mise en page ; pour une
autre apparence, ajouter une variante au composant.

## Design

Maquettes et tokens dans le fichier Paper **HORAYA** (pages 00 à 05). Les tokens
(couleurs, typo) sont reportés dans `apps/web/src/app/globals.css`.

Polices, toutes Google Fonts (libres de droits), chargées via `next/font` :

- **Archivo** (variable, axe de largeur) pour les titres. Remplace Sztos des maquettes.
  Utilitaires : `font-headline` (gros titres) et `font-section` (en-têtes de section).
- **Urbanist** pour l'interface.
- **Geist Mono** pour les labels et les données.

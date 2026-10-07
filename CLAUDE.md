# Horaya v2 — méthode de travail

Refonte complète d'Horaya, menée lot par lot avec Moh. Tout est en français : interface
(tutoiement), messages de commit, notes, échanges.

- Architecture et décisions : vault → `Projets/Horaya/Refonte v2/Horaya v2 · Architecture.md`
- Avancement des lots : vault → `Projets/Horaya/Refonte v2/Horaya v2 · Feuille de route.md`
- Maquettes : fichier Paper `HORAYA` (fileId `01M482V27PJ1B95FS517QHZRP4`)

Le vault Obsidian de Moh : `/Volumes/moh-drive/hub/notes/hub` (synchronisé avec le VPS, l'iPhone et le Mac).

## Déroulé d'un lot

1. **Lire les maquettes dans Paper** quand le lot a des écrans : `get_jsx` / `get_computed_styles`
   pour les valeurs exactes, jamais à l'œil. Compter chaque appel Paper.
2. **Coder** dans l'ordre core → db → web. Le core reste sans Next.js, Hono ni Postgres ; l'app
   web appelle les cas d'usage du core (`deps`, `requireMember()` dans `apps/web/src/server/`),
   jamais l'API HTTP.
3. **Vérifier** : `pnpm typecheck`, `pnpm test`, `rtk proxy pnpm lint` (sans `rtk proxy`, le hook
   remplace Biome par ESLint), `pnpm build`, puis le rendu dans Chrome avec `playwright-core`
   installé dans le scratchpad (jamais dans le repo).
4. **Commit** sur `feature/refonte-v2` (le lint doit sortir en 0 : vérifier le code de retour).
5. **Documenter dans le vault** (section suivante).
6. **Faire le point avec Moh** : ce qui est fait, ce qui reste, et toujours le nombre d'appels
   Paper du lot et le total de la session.

## Documentation dans le vault

Lire `AGENTS.md` du vault avant d'y écrire. Règles qui comptent ici :
ne jamais ouvrir `Privé/`, ne jamais supprimer (on archive), ne jamais réécrire le texte de
Moh (on ajoute), en-tête YAML valide, heure de Paris (`TZ=Europe/Paris date`), chaque fichier
écrit en une seule fois, pas de fichier temporaire dans le vault.

À la fin de chaque lot :

1. **Captures** de l'app réelle (JPEG qualité 82, 1440 × 1024, plus mobile 390 px si utile),
   prises hors du vault puis déplacées vers `_system/Médias/Horaya/` sous le nom
   `horaya-v2-lotN-<écran>.jpg`. Les maquettes existent déjà : `horaya-paper-<n°>-<écran>.jpg`.
2. **Note du lot** : `Projets/Horaya/Refonte v2/Horaya v2 · Lot N — Titre.md`, sur le modèle des
   lots précédents : en-tête (`type: note`, `domaine: "[[Dev]]"`, `sujets`, tags
   `horaya, refonte-v2, lot`), « En bref », tableau statut / date / commits / tests / appels
   Paper / lots voisins, captures en tableaux « Maquette | App », ce qui a été fait, décisions,
   retours de Moh, reste à faire.
3. **Feuille de route** : passer le lot en terminé, date, appels Paper, lien vers la note.
4. **`Projets/Horaya/Horaya.md`** : mettre à jour `maj` et `prochaine_action` (une action courte
   à l'infinitif), ajouter une entrée datée en tête de « Journal de projet ».
5. **Journal du jour** `Journal/AAAA/AAAA-MM-JJ.md` : une ligne sous `<!-- /auto:activite -->`
   (jamais à l'intérieur du bloc automatique).
6. **Journal d'actions** `_system/Logs/AAAA-MM-JJ.md` : une ligne par fichier créé, déplacé ou
   modifié.

## Conventions de code

- **Next.js 16** : lire la doc embarquée (`apps/web/node_modules/next/dist/docs/`) avant d'utiliser
  une API ; `proxy.ts` remplace `middleware`, `params` et `searchParams` sont des promesses.
- **Pas de fusion de classes Tailwind** : `className` sert à la mise en page ; pour une autre
  apparence, ajouter une variante au composant.
- **Tout ce qui est cliquable a le curseur main** (règle globale dans `globals.css`), le curseur
  interdit quand c'est désactivé.
- **Composants serveur → client** : ne jamais passer de fonction en prop ; préférer des liens
  (`href`) ou une action serveur.
- **Zod 4** : les `.default()` s'appliquent aussi aux clés absentes ; pas de valeur par défaut
  dans un schéma de mise à jour partielle.
- Design system : `apps/web/src/components/` (vitrine sur `/app/design-system`).

## Environnement local

- `pnpm db:up` : Postgres 16 et Mailpit (e-mails sur http://localhost:8025).
- Variables dans le `.env` à la racine (chargé par `next.config.ts`).
- Le port 3000 est souvent pris par un autre projet de Moh : lancer l'app sur 3100 avec
  `BETTER_AUTH_URL=http://localhost:3100 pnpm exec next dev -p 3100` (depuis `apps/web`).
- Ne jamais arrêter un processus qui n'appartient pas à Horaya.

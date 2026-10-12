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
4. **Commit** sur une branche `lot/…` ou `fix/…` partie de `origin/develop` (le lint doit sortir
   en 0 : vérifier le code de retour), puis PR vers `develop` avec `gh pr create`. Moh la fusionne
   en squash ; la fusion déploie sur staging.
5. **Documenter dans le vault** (section suivante), depuis le poste integration, après la fusion.
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
- Variables dans le `.env` à la racine du poste (chargé par `next.config.ts` et les scripts).
- `pnpm dev` écoute sur le `PORT` du `.env` (3100, 3101 ou 3102 selon le poste). Le port 3000 est
  souvent pris par un autre projet de Moh.
- Ne jamais arrêter un processus qui n'appartient pas à Horaya.

## Postes de travail

Trois worktrees git permanents, chacun avec son port, sa base et ses cookies. Le poste courant
est la variable `POSTE` du `.env` : la lire avant de commencer, et appliquer ses règles.

| Dossier | POSTE | Port | Base | Rôle |
|---|---|---|---|---|
| `horaya-v2/` | integration | 3100 | horaya | suit `develop`, recette, documentation du vault |
| `../horaya-lot/` | lot | 3101 | horaya_lot | lot en cours, seul poste autorisé à générer des migrations |
| `../horaya-fix/` | fix | 3102 | horaya_fix | retouches courtes, pas de modification de schéma |

- `develop` ne reçoit que des PR fusionnées en squash (chaque push dessus déploie sur staging ;
  la CI tourne sur les PR). Les branches de travail (`lot/…`, `fix/…`) partent toujours de
  `origin/develop`.
- Postgres et Mailpit restent uniques dans Docker : un conteneur, une base par poste. Les bases
  de test en dérivent (`horaya_lot_test_db`…), les postes ne se gênent donc pas.
- `pnpm poste:init <lot|fix>` (depuis integration) crée un poste : worktree, `.env`, dépendances,
  base de démo. `pnpm poste:reset` (lot et fix seulement) repart d'une base neuve avec le compte
  `demo@horaya.local` / `Demo-Horaya-2026` et l'espace `demo`.
- `pnpm db:generate` refuse de tourner hors du poste lot, ou si la branche n'est pas à jour de
  `origin/develop`.

Règles selon `POSTE` :
- **fix** : pas de migration ni de refactor du code partagé (`packages/*`, `components/ui`). Si une
  retouche exige un changement de schéma, s'arrêter et le dire à Moh.
- **lot** : `git rebase origin/develop` avant toute génération de migration, puis `pnpm db:migrate`
  après chaque rebase.
- **integration** : pas de développement ; `git pull`, recette, mise à jour du vault après la
  fusion d'un lot. C'est le seul poste qui écrit dans le vault.
- **Partout** : ne jamais pousser sur `develop`, passer par `gh pr create` ; ne jamais modifier
  une migration déjà fusionnée.
- **Conflit de numérotation de migration** : supprimer sa migration (fichier SQL, entrée de
  `packages/db/migrations/meta/_journal.json`, snapshot), `git rebase origin/develop`,
  `pnpm db:generate`, puis `pnpm poste:reset`.

Journée type : `WORKFLOW.md`.

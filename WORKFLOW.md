# Journée type avec les postes de travail

Les trois postes (integration, lot, fix) sont décrits dans `CLAUDE.md`, section « Postes de
travail ». Chaque poste a son dossier, son port, sa base et sa session Claude.

1. **Integration (`horaya-v2/`, port 3100)** : `git pull` pour récupérer `develop`.
2. **Lot (`../horaya-lot/`, port 3101)** : `git fetch && git rebase origin/develop`, puis
   `pnpm db:migrate`. On continue le lot sur sa branche `lot/<n>-<sujet>`. S'il faut une migration :
   rebase d'abord, puis `pnpm db:generate`.
3. **Fix (`../horaya-fix/`, port 3102)** : une branche courte par retouche
   (`git switch -c fix/<sujet> origin/develop`), une PR rapide (`gh pr create --base develop`).
   Pas de schéma : si besoin, on s'arrête et on le reporte au lot.
4. **PR du lot** : quand le lot est prêt, rebase sur `origin/develop`, vérifications complètes
   (typecheck, tests, lint, build), puis `gh pr create --base develop`.
5. **Fusion** : Moh fusionne en squash ; `develop` part sur staging.
6. **Integration** : `git pull`, recette sur http://localhost:3100 et sur staging, puis
   documentation du lot dans le vault (captures, note du lot, feuille de route, journaux).

Démarrer un nouveau lot : dans `../horaya-lot/`, `git fetch`, `git switch -c lot/<n>-<sujet>
origin/develop`, `pnpm db:migrate` (ou `pnpm poste:reset` pour repartir de la démo).

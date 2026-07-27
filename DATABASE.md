# Horaya Database

## Démarrer la base de données

```bash
# Démarrer PostgreSQL
docker compose up -d

# Vérifier que c'est bien démarré
docker compose ps

# Voir les logs
docker compose logs -f postgres
```

## Arrêter la base de données

```bash
# Arrêter sans supprimer les données
docker compose stop

# Arrêter et supprimer les containers (garde les données)
docker compose down

# Tout supprimer (containers + volumes + données)
docker compose down -v
```

## Se connecter à la base

```bash
# Via docker
docker compose exec postgres psql -U user -d horaya

# Via psql local (si installé)
psql -h localhost -U user -d horaya
# Password: pass
```

## Informations de connexion

- **Host**: localhost
- **Port**: 5432
- **Database**: horaya
- **User**: user
- **Password**: pass
- **Connection String**: `postgres://user:pass@localhost:5432/horaya`

## Réinitialiser la base

```bash
# Supprimer tout et recréer
docker compose down -v
docker compose up -d
```

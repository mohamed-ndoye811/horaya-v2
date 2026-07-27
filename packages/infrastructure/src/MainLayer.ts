import { Layer } from "effect"
import { ConfigLive } from "./config/ConfigLive"
import { PostgresDatabaseLayer } from "./persistence/postgres/PostgresDatabase"
import { EventPostgresRepository } from "./persistence/postgres/repositories/EventPostgresRepository"
import { EventTypePostgresRepository } from "./persistence/postgres/repositories/EventTypePostgresRepository";

const RepositoriesLayer = Layer.merge(
  EventPostgresRepository,
  EventTypePostgresRepository
);


export const MainLayer = RepositoriesLayer.pipe(
  Layer.provide(PostgresDatabaseLayer),
  Layer.provide(ConfigLive),
)

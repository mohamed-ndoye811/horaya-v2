import { type Deps, type Repositories, systemClock, type UnitOfWork } from "@horaya/core";
import type { Db, Executor } from "./client";
import { bookingRepository } from "./repositories/bookings";
import { eventRepository, eventTypeRepository } from "./repositories/events";
import {
  activityLogRepository,
  customerRepository,
  referenceCounterRepository,
  tenantSettingsReader,
} from "./repositories/support";

export function repositoriesFor(db: Executor): Repositories {
  return {
    eventTypes: eventTypeRepository(db),
    events: eventRepository(db),
    bookings: bookingRepository(db),
    customers: customerRepository(db),
    references: referenceCounterRepository(db),
    activity: activityLogRepository(db),
    settings: tenantSettingsReader(db),
  };
}

export function createUnitOfWork(db: Db): UnitOfWork {
  return {
    run: (work) => db.transaction((tx) => work(repositoriesFor(tx))),
  };
}

/** Dépendances prêtes à l'emploi pour appeler les cas d'usage du core. */
export function createDeps(db: Db): Deps {
  return { uow: createUnitOfWork(db), clock: systemClock };
}

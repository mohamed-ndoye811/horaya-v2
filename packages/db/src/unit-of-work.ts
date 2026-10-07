import {
  type ActivityEntry,
  type Deps,
  type Repositories,
  systemClock,
  type UnitOfWork,
} from "@horaya/core";
import type { Db, Executor } from "./client";
import { bookingRepository } from "./repositories/bookings";
import { eventRepository, eventTypeRepository } from "./repositories/events";
import { inventoryRepository } from "./repositories/inventory";
import { paymentRepository } from "./repositories/payments";
import {
  activityLogRepository,
  customerRepository,
  notificationPreferenceRepository,
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
    inventory: inventoryRepository(db),
    notifications: notificationPreferenceRepository(db),
    payments: paymentRepository(db),
  };
}

export interface UnitOfWorkHooks {
  /**
   * Appelé après la validation de la transaction avec les entrées du journal d'activité
   * qu'elle a écrites (e-mails aux clients, notifications…). Jamais si elle échoue ;
   * une erreur ici est journalisée sans annuler ce qui vient d'être enregistré.
   */
  afterCommit?: (entries: ActivityEntry[]) => Promise<void> | void;
}

export function createUnitOfWork(db: Db, hooks: UnitOfWorkHooks = {}): UnitOfWork {
  return {
    async run(work) {
      const recorded: ActivityEntry[] = [];
      const result = await db.transaction((tx) => {
        const repositories = repositoriesFor(tx);
        const activity = repositories.activity;
        return work({
          ...repositories,
          activity: {
            async record(entry) {
              await activity.record(entry);
              recorded.push(entry);
            },
          },
        });
      });
      if (hooks.afterCommit && recorded.length > 0) {
        try {
          await hooks.afterCommit(recorded);
        } catch (error) {
          console.error("afterCommit", error);
        }
      }
      return result;
    },
  };
}

/** Dépendances prêtes à l'emploi pour appeler les cas d'usage du core. */
export function createDeps(db: Db, hooks?: UnitOfWorkHooks): Deps {
  return { uow: createUnitOfWork(db, hooks), clock: systemClock };
}

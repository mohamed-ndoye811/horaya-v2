import type {
  ActivityLog,
  BookingRepository,
  CustomerRepository,
  ReferenceCounter,
} from "../bookings/ports";
import type { EventRepository, EventTypeRepository } from "../events/ports";
import type { InventoryRepository } from "../inventory/ports";
import type { NotificationPreferenceRepository } from "../tenants/ports";
import type { TenantSettingsStore } from "../tenants/settings";
import type { Clock } from "./clock";

/** Dépôts liés à une même transaction. */
export interface Repositories {
  eventTypes: EventTypeRepository;
  events: EventRepository;
  bookings: BookingRepository;
  customers: CustomerRepository;
  references: ReferenceCounter;
  activity: ActivityLog;
  settings: TenantSettingsStore;
  inventory: InventoryRepository;
  notifications: NotificationPreferenceRepository;
}

/** Exécute un travail dans une transaction : tout est validé, ou rien. */
export interface UnitOfWork {
  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}

/** Dépendances communes des cas d'usage. */
export interface Deps {
  uow: UnitOfWork;
  clock: Clock;
}

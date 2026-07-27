import { Event as DomainEvent } from "@horaya/domain/event/Event"
import { EventId } from "@horaya/domain/event/value-objects/EventId"
import { TimeSlot } from "@horaya/domain/shared/value-objects/TimeSlot"
import { TenantId } from "@horaya/domain/shared/value-objects/TenantId"
import type { Event, NewEvent } from "../schema"

export const EventPostgresMapper = {
  toPersistence(event: DomainEvent): NewEvent {
    return {
      id: event.id.value,
      tenantId: event.tenantId.toString(),
      title: event.title,
      startAt: event.slot.start,
      endAt: event.slot.end,
      capacity: event.capacity,
      description: event.description,
    }
  },

  toDomain(row: Event): DomainEvent {
    return DomainEvent.reconstitute({
      id: EventId.fromTrusted(row.id),
      tenantId: TenantId.fromTrusted(row.tenantId),
      title: row.title,
      slot: TimeSlot.fromTrusted(row.startAt, row.endAt),
      capacity: row.capacity,
      description: row.description,
    })
  },
}

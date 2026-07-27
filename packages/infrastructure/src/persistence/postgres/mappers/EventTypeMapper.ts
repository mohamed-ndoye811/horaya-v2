import { TenantId } from "@horaya/domain/shared/value-objects/TenantId"
import { EventType as DomainEventType } from "@horaya/domain/event-type/EventType"
import { EventTypeId } from "@horaya/domain/event-type/value-objects/EventTypeId"
import { Color } from "@horaya/domain/shared/value-objects/Color"
import type { EventType, NewEventType } from "../schema"

export const EventTypePostgresMapper = {
  toPersistence(eventType: DomainEventType): NewEventType {
    return {
      id: eventType.id.value,
      tenantId: eventType.tenantId.toString(),
      name: eventType.name,
      description: eventType.description,
      color: eventType.color.toString(),
    }
  },

  toDomain(row: EventType): DomainEventType {
    return DomainEventType.reconstitute({
      id: EventTypeId.fromTrusted(row.id),
      tenantId: TenantId.fromTrusted(row.tenantId),
      name: row.name,
      description: row.description,
      color: Color.fromTrusted(row.color),
    })
  },
}

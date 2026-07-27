import { Effect } from "effect"
import { Event } from "@horaya/domain/event/Event"
import { EventId } from "@horaya/domain/event/value-objects/EventId"
import { TimeSlot } from "@horaya/domain/shared/value-objects/TimeSlot"
import { TenantId } from "@horaya/domain/shared/value-objects/TenantId"
import { EventRepository } from "@horaya/domain/event/EventRepository"

export interface CreateEventCommand {
  readonly id: string
  readonly tenantId: string
  readonly title: string
  readonly start: Date
  readonly end: Date
  readonly capacity: number
  readonly description: string
}

export const createEvent = (cmd: CreateEventCommand) =>
  Effect.gen(function* () {
    const repo = yield* EventRepository

    const id = yield* EventId.make(cmd.id)
    const tenantId = yield* TenantId.make(cmd.tenantId)
    const slot = yield* TimeSlot.make(cmd.start, cmd.end)

    const event = Event.create({
      id, tenantId, title: cmd.title, slot, capacity: cmd.capacity, description: cmd.description
    })

    yield* repo.save(event)
    return event
  })
import { EventType } from '@horaya/domain/event-type/EventType';
import { Effect } from "effect"
import { TenantId } from "@horaya/domain/shared/value-objects/TenantId"
import { Color } from "@horaya/domain/shared/value-objects/Color"
import { EventTypeId } from '@horaya/domain/event-type/value-objects/EventTypeId';
import { EventTypeRepository } from '@horaya/domain/event-type/EventTypeRepository';

interface createEventCommand {
    readonly id: string
    readonly tenantId: string
    readonly name: string
    readonly color: string
    readonly description: string
}

export const createEventType= (cmd: createEventCommand) => Effect.gen(
    function* () {
        const repo = yield* EventTypeRepository

        const eventTypeId = yield* EventTypeId.make(cmd.id)
        const tenantId = yield* TenantId.make(cmd.tenantId)
        const color = yield* Color.make(cmd.color)

        const eventType = EventType.create({
            id: eventTypeId,
            tenantId: tenantId,
            name: cmd.name,
            color: color,
            description: cmd.description
        })

        yield* repo.save(eventType)

        return eventType
    })
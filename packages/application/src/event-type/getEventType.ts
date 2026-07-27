import {Effect} from "effect";
import {EventType} from "@horaya/domain/event-type/EventType";
import {EventTypeId} from "@horaya/domain/event-type/value-objects/EventTypeId";
import {EventTypeRepository} from "@horaya/domain/event-type/EventTypeRepository";

interface getEventTypeCommand {
    id: string
}

export const getEventType = (cmd: getEventTypeCommand) => Effect.gen(
    function* () {
        const repo = yield* EventTypeRepository
        const eventTypeId = yield* EventTypeId.make(cmd.id)
        const eventType = yield* repo.findById(eventTypeId)

        return eventType
    }
)
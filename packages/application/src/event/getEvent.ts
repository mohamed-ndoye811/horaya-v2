import { Effect } from "effect"
import { Event } from "@horaya/domain/event/Event"
import { EventId } from "@horaya/domain/event/value-objects/EventId"
import { EventRepository } from "@horaya/domain/event/EventRepository"

interface getEventCommand {
    id: string
}

export const getEvent = (cmd: getEventCommand) => Effect.gen(
    function* () {
        const repo = yield* EventRepository
        const eventId = yield* EventId.make(cmd.id)
        const event = yield* repo.findById(eventId)
        return event
    }
)
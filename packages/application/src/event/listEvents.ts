import { Effect } from "effect";
import { Event } from "@horaya/domain/event/Event";
import { EventRepository } from "@horaya/domain/event/EventRepository";

export const listEvents = () => Effect.gen(
    function* () {
        const repo = yield* EventRepository
        const events = yield* repo.listEvents()
        return events
    }
)
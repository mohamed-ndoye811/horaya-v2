import { Effect } from "effect";
import { Event } from "@horaya/domain/event/Event";
import { EventRepository } from "@horaya/domain/event/EventRepository";

export const listEventsByTenantId = (tenantId: string) => Effect.gen(
    function* () {
        const repo = yield* EventRepository
        const events = yield* repo.listEventsByTenantId(tenantId)
        return events
    }
)
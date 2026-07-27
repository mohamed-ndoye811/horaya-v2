import { Event } from '@horaya/domain/event/Event';

export interface EventResponse {
  id: string;
  tenantId: string;
  title: string;
  start: string;
  end: string;
  capacity: number;
  description: string;
}

export const EventMapper = {
  toResponse(event: Event): EventResponse {
    return {
      id: event.id.value,
      tenantId: event.tenantId.toString(),
      title: event.title,
      start: event.slot.start.toISOString(),
      end: event.slot.end.toISOString(),
      capacity: event.capacity,
      description: event.description,
    };
  },
  toListResponse(events: Event[]): EventResponse[] {
    return events.map((event) => this.toResponse(event));
  }
};

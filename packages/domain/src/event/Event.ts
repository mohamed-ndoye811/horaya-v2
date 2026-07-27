import { TimeSlot } from "../shared/value-objects/TimeSlot";
import { TenantId } from "../shared/value-objects/TenantId";
import { EventId } from "./value-objects/EventId";

interface EventProps {
    readonly id: EventId;
    readonly tenantId: TenantId;
    readonly slot: TimeSlot;
    readonly title: string;
    readonly description: string;
    readonly capacity: number;
}

export class Event {
  private constructor(private readonly props: EventProps) {}

  static create(props: EventProps): Event {
    return new Event(props)
  }

  static reconstitute(props: EventProps): Event {
    return new Event(props)
  }

  get id(): EventId { return this.props.id }
  get tenantId(): TenantId { return this.props.tenantId }
  get title(): string { return this.props.title }
  get slot(): TimeSlot { return this.props.slot }
  get capacity(): number { return this.props.capacity }
  get description(): string { return this.props.description }
}
import type { Color } from "../shared/value-objects/Color";
import type { TenantId } from "../shared/value-objects/TenantId";
import { EventTypeId } from "./value-objects/EventTypeId";

export interface EventTypeProps {
    readonly id: EventTypeId;
    readonly tenantId: TenantId;
    readonly name: string;
    readonly description: string;
    readonly color: Color;
}

export class EventType {
    private constructor(private readonly props: EventTypeProps) {}

    static create(props: EventTypeProps): EventType {
        return new EventType(props)
    }

    static reconstitute(props: EventTypeProps): EventType {
        return new EventType(props)
    }

    get id(): EventTypeId { return this.props.id }
    get name(): string { return this.props.name }
    get description(): string { return this.props.description }
    get color(): Color { return this.props.color }
    get tenantId(): TenantId { return this.props.tenantId }
}
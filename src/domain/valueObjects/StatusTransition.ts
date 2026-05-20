import { SerializedItemStatus } from '../enums/SerializedItemStatus';
import { ActorId } from './ActorId';

export class StatusTransition {
  constructor(
    public readonly from: SerializedItemStatus,
    public readonly to: SerializedItemStatus,
    public readonly reason: string,
    public readonly actor: ActorId,
    public readonly occurredAt: Date,
    public readonly referenceId?: string
  ) {}
}

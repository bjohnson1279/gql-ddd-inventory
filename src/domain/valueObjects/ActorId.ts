export class ActorId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("ActorId cannot be empty.");
    }
  }

  equals(other: ActorId): boolean {
    return this.value === other.value;
  }
}

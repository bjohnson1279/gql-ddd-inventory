export class TaskPerformanceId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('TaskPerformanceId cannot be empty.');
    }
  }

  equals(other: TaskPerformanceId): boolean {
    if (!other || !(other instanceof TaskPerformanceId)) {
      return false;
    }
    return this.value === other.value;
  }
}

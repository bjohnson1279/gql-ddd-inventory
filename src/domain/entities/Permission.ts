/**
 * Permission Domain Entity
 *
 * Represents a single resource:action permission in the canonical catalog.
 */
export class Permission {
  constructor(
    public readonly id: string,
    public readonly resource: string,
    public readonly action: string,
    public readonly description: string = ''
  ) {
    if (!resource || resource.trim().length === 0) {
      throw new Error('Permission resource cannot be empty.');
    }
    if (!action || action.trim().length === 0) {
      throw new Error('Permission action cannot be empty.');
    }
  }

  /**
   * Returns the canonical permission key in resource:action format.
   */
  get key(): string {
    return `${this.resource}:${this.action}`;
  }

  /**
   * Tests whether this permission matches a given resource and action.
   */
  matches(resource: string, action: string): boolean {
    return this.resource === resource && this.action === action;
  }

  /**
   * Tests whether this permission matches a given permission key string.
   */
  matchesKey(key: string): boolean {
    return this.key === key;
  }
}

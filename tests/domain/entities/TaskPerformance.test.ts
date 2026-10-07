import { TaskPerformance } from '../../../src/domain/entities/TaskPerformance';

describe('TaskPerformance Entity', () => {
  it('should correctly initialize all properties', () => {
    const id = 'tp-123';
    const operatorId = 'op-456';
    const tenantId = 'tenant-789';
    const taskType = 'PICKING';
    const locationId = 'loc-101';
    const traversalDistanceMeters = 150.5;
    const durationSeconds = 300;
    const accuracyScore = 0.98;
    const occurredAt = new Date('2025-01-01T00:00:00Z');

    const perf = new TaskPerformance(
      id,
      operatorId,
      tenantId,
      taskType,
      locationId,
      traversalDistanceMeters,
      durationSeconds,
      accuracyScore,
      occurredAt
    );

    expect(perf.id).toBe(id);
    expect(perf.operatorId).toBe(operatorId);
    expect(perf.tenantId).toBe(tenantId);
    expect(perf.taskType).toBe(taskType);
    expect(perf.locationId).toBe(locationId);
    expect(perf.traversalDistanceMeters).toBe(traversalDistanceMeters);
    expect(perf.durationSeconds).toBe(durationSeconds);
    expect(perf.accuracyScore).toBe(accuracyScore);
    expect(perf.occurredAt).toBe(occurredAt);
  });
});

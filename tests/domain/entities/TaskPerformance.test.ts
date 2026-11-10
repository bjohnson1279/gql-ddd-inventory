import { TaskPerformance } from '../../../src/domain/entities/TaskPerformance';
import { TaskPerformanceId } from '../../../src/domain/valueObjects/TaskPerformanceId';

describe('TaskPerformance Entity', () => {
  it('should correctly initialize all properties when id is a string', () => {
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

    expect(perf.id).toBeInstanceOf(TaskPerformanceId);
    expect(perf.id.value).toBe(id);
    expect(perf.operatorId).toBe(operatorId);
    expect(perf.tenantId).toBe(tenantId);
    expect(perf.taskType).toBe(taskType);
    expect(perf.locationId).toBe(locationId);
    expect(perf.traversalDistanceMeters).toBe(traversalDistanceMeters);
    expect(perf.durationSeconds).toBe(durationSeconds);
    expect(perf.accuracyScore).toBe(accuracyScore);
    expect(perf.occurredAt).toBe(occurredAt);
  });

  it('should correctly initialize when id is a TaskPerformanceId instance', () => {
    const perfId = new TaskPerformanceId('tp-456');
    const perf = new TaskPerformance(
      perfId,
      'op-1',
      'tenant-1',
      'PUTAWAY',
      'loc-1',
      50,
      120,
      1.0,
      new Date('2025-01-01T00:00:00Z')
    );

    expect(perf.id).toBe(perfId);
    expect(perf.id.value).toBe('tp-456');
  });
});

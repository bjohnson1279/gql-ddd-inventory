import { LaborShift } from '../../../src/domain/entities/LaborShift';

describe('LaborShift Entity', () => {
  it('should correctly initialize all properties when instantiated', () => {
    const id = 'shift-123';
    const operatorId = 'op-456';
    const tenantId = 'tenant-789';
    const startTime = new Date('2023-10-01T08:00:00Z');
    const endTime = new Date('2023-10-01T16:00:00Z');
    const status = 'SCHEDULED';
    const predictedDemand = 150;
    const actualCompleted = 140;
    const createdAt = new Date('2023-09-30T10:00:00Z');
    const updatedAt = new Date('2023-09-30T10:00:00Z');

    const shift = new LaborShift(
      id,
      operatorId,
      tenantId,
      startTime,
      endTime,
      status,
      predictedDemand,
      actualCompleted,
      createdAt,
      updatedAt
    );

    expect(shift.id).toBe('shift-123');
    expect(shift.operatorId).toBe('op-456');
    expect(shift.tenantId).toBe('tenant-789');
    expect(shift.startTime).toEqual(startTime);
    expect(shift.endTime).toEqual(endTime);
    expect(shift.status).toBe('SCHEDULED');
    expect(shift.predictedDemand).toBe(150);
    expect(shift.actualCompleted).toBe(140);
    expect(shift.createdAt).toEqual(createdAt);
    expect(shift.updatedAt).toEqual(updatedAt);
  });
});

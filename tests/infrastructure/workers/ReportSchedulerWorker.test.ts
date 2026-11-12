jest.mock('cron-parser', () => ({
  parseExpression: jest.fn(() => ({
    next: () => ({
      toDate: () => new Date('2026-10-29T00:00:00Z'),
    }),
  })),
}), { virtual: true });

import { ReportSchedulerWorker } from '../../../src/infrastructure/workers/ReportSchedulerWorker';
import { prisma } from '../../../src/infrastructure/persistence/prismaClient';

jest.mock('../../../src/infrastructure/persistence/prismaClient', () => {
  const mockTx = {
    reportExecutionModel: {
      create: jest.fn(),
    },
    outboxEvent: {
      create: jest.fn(),
    },
    reportScheduleModel: {
      update: jest.fn(),
    },
  };
  return {
    prisma: {
      reportScheduleModel: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockTx)),
    },
    _mockTx: mockTx,
  };
});

describe('ReportSchedulerWorker', () => {
  let worker: ReportSchedulerWorker;
  const { _mockTx } = require('../../../src/infrastructure/persistence/prismaClient');

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new ReportSchedulerWorker();
  });

  afterEach(() => {
    worker.stop();
  });

  it('should not start a transaction if there are no due schedules', async () => {
    (prisma.reportScheduleModel.findMany as jest.Mock).mockResolvedValue([]);

    await (worker as any).poll();

    expect(prisma.reportScheduleModel.findMany).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
        nextRunAt: { lte: expect.any(Date) },
      },
      take: 50,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should batch all due schedules in a single transaction', async () => {
    const schedules = [
      { id: 'sched-1', reportDefinitionId: 'def-1', cronExpression: '0 0 * * *' },
      { id: 'sched-2', reportDefinitionId: 'def-2', cronExpression: '*/15 * * * *' },
    ];
    (prisma.reportScheduleModel.findMany as jest.Mock).mockResolvedValue(schedules);
    _mockTx.reportExecutionModel.create
      .mockResolvedValueOnce({ id: 'exec-1' })
      .mockResolvedValueOnce({ id: 'exec-2' });

    await (worker as any).poll();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(_mockTx.reportExecutionModel.create).toHaveBeenCalledTimes(2);
    expect(_mockTx.outboxEvent.create).toHaveBeenCalledTimes(2);
    expect(_mockTx.reportScheduleModel.update).toHaveBeenCalledTimes(2);
    expect(_mockTx.reportExecutionModel.create).toHaveBeenNthCalledWith(1, {
      data: {
        reportDefinitionId: 'def-1',
        format: 'csv',
        status: 'PENDING',
      },
    });
    expect(_mockTx.outboxEvent.create).toHaveBeenNthCalledWith(1, {
      data: {
        eventType: 'ReportExecutionRequested',
        payload: JSON.stringify({ executionId: 'exec-1' }),
      },
    });
    expect(_mockTx.reportScheduleModel.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'sched-1' },
      data: {
        lastRunAt: expect.any(Date),
        nextRunAt: expect.any(Date),
      },
    });
  });

  it('should log error when polling fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (prisma.reportScheduleModel.findMany as jest.Mock).mockRejectedValue(new Error('DB failure'));

    jest.useFakeTimers();
    worker.start(1000);
    await jest.advanceTimersByTimeAsync(1000);
    jest.useRealTimers();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'ReportSchedulerWorker',
        message: 'Polling error',
      })
    );
    consoleSpy.mockRestore();
  });
});

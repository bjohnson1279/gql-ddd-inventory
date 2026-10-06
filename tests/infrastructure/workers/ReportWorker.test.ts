import { ReportGenerationWorker } from '../../../src/infrastructure/workers/ReportGenerationWorker';
import { prisma } from '../../../src/infrastructure/persistence/prismaClient';

jest.mock('../../../src/infrastructure/persistence/prismaClient', () => ({
  prisma: {
    reportExecutionModel: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    outboxEvent: {
      create: jest.fn()
    }
  }
}));

jest.mock('../../../src/infrastructure/services/ReportGeneratorService', () => {
  return {
    ReportGeneratorService: jest.fn().mockImplementation(() => ({
      generateReport: jest.fn().mockResolvedValue('https://s3.amazonaws.com/reports/exec-123.csv')
    }))
  };
});

describe('ReportGenerationWorker', () => {
  it('should process ReportExecutionRequested payload correctly', async () => {
    const worker = new ReportGenerationWorker();
    (prisma.reportExecutionModel.findUnique as jest.Mock).mockResolvedValue({
      id: 'exec-123',
      reportDefinitionId: 'def-1',
      format: 'csv'
    });
    (prisma.reportExecutionModel.update as jest.Mock).mockResolvedValue({});

    await worker.processEvent(JSON.stringify({ executionId: 'exec-123' }));

    expect(prisma.reportExecutionModel.findUnique).toHaveBeenCalledWith({ where: { id: 'exec-123' } });
    expect(prisma.reportExecutionModel.update).toHaveBeenCalledWith({
      where: { id: 'exec-123' },
      data: { status: 'PROCESSING' }
    });
    expect(prisma.reportExecutionModel.update).toHaveBeenCalledWith({
      where: { id: 'exec-123' },
      data: { status: 'COMPLETED', completedAt: expect.any(Date), fileUrl: 'https://s3.amazonaws.com/reports/exec-123.csv' }
    });
  });
});

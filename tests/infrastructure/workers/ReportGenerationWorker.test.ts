import { ReportGenerationWorker } from '../../../src/infrastructure/workers/ReportGenerationWorker';
import { prisma } from '../../../src/infrastructure/persistence/prismaClient';

jest.mock('../../../src/infrastructure/services/ReportGeneratorService', () => {
  return {
    ReportGeneratorService: jest.fn().mockImplementation(() => ({
      generateReport: jest.fn(),
    })),
  };
});

jest.mock('../../../src/infrastructure/persistence/prismaClient', () => ({
  prisma: {
    reportExecutionModel: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('ReportGenerationWorker', () => {
  let worker: ReportGenerationWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new ReportGenerationWorker();
  });

  it('should process ReportExecutionRequested event with string payload', async () => {
    const mockExecution = {
      id: 'exec-1',
      reportDefinitionId: 'def-1',
      format: 'csv',
    };

    (prisma.reportExecutionModel.findUnique as jest.Mock).mockResolvedValue(mockExecution);
    (prisma.reportExecutionModel.update as jest.Mock).mockResolvedValue({});

    ((worker as any).generator.generateReport as jest.Mock).mockResolvedValue('https://storage.example.com/report.csv');

    await worker.processEvent(JSON.stringify({ executionId: 'exec-1' }));

    expect(prisma.reportExecutionModel.findUnique).toHaveBeenCalledWith({ where: { id: 'exec-1' } });
    expect(prisma.reportExecutionModel.update).toHaveBeenCalledWith({
      where: { id: 'exec-1' },
      data: { status: 'PROCESSING' },
    });
    expect(prisma.reportExecutionModel.update).toHaveBeenCalledWith({
      where: { id: 'exec-1' },
      data: {
        status: 'COMPLETED',
        completedAt: expect.any(Date),
        fileUrl: 'https://storage.example.com/report.csv',
      },
    });
  });

  it('should process ReportExecutionRequested event with object payload', async () => {
    const mockExecution = {
      id: 'exec-2',
      reportDefinitionId: 'def-2',
      format: 'pdf',
    };

    (prisma.reportExecutionModel.findUnique as jest.Mock).mockResolvedValue(mockExecution);
    (prisma.reportExecutionModel.update as jest.Mock).mockResolvedValue({});

    ((worker as any).generator.generateReport as jest.Mock).mockResolvedValue('https://storage.example.com/report.pdf');

    await worker.processEvent({ executionId: 'exec-2' });

    expect(prisma.reportExecutionModel.findUnique).toHaveBeenCalledWith({ where: { id: 'exec-2' } });
    expect(prisma.reportExecutionModel.update).toHaveBeenCalledWith({
      where: { id: 'exec-2' },
      data: {
        status: 'COMPLETED',
        completedAt: expect.any(Date),
        fileUrl: 'https://storage.example.com/report.pdf',
      },
    });
  });
});

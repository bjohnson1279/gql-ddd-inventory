import { reportResolvers } from '../../../src/infrastructure/graphql/reportResolvers';

describe('reportResolvers', () => {
  const mockPrisma = {
    reportDefinitionModel: {
      findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Stock Report' }]),
      create: jest.fn().mockResolvedValue({ id: 'r2', name: 'New Report' })
    },
    sharedReportLinkModel: {
      findUnique: jest.fn().mockResolvedValue({ 
        token: 'valid-token', 
        expiresAt: new Date(Date.now() + 10000),
        reportExecution: { fileUrl: 'https://cdn.example.com/report.csv' } 
      })
    },
    reportScheduleModel: {
      create: jest.fn().mockResolvedValue({ id: 's1', cronExpression: '0 0 * * *' })
    },
    reportExecutionModel: {
      create: jest.fn().mockResolvedValue({ id: 'e1', status: 'PENDING' })
    },
    dashboardWidgetModel: {
      findMany: jest.fn().mockResolvedValue([{ id: 'w1', type: 'CHART' }]),
      create: jest.fn().mockResolvedValue({ id: 'w2' }),
      update: jest.fn().mockResolvedValue({ id: 'w1', width: 2 }),
      delete: jest.fn().mockResolvedValue(true),
      findUnique: jest.fn().mockResolvedValue({ id: 'w1', tenantId: 'tenant-1' })
    }
  };

  const context = { prisma: mockPrisma, auth: { tenantId: 'tenant-1', userId: 'user-1' } };

  it('should list reports', async () => {
    const res = await reportResolvers.Query.reports(null, null, context);
    expect(res).toHaveLength(1);
    expect(mockPrisma.reportDefinitionModel.findMany).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1' } });
  });

  it('should fetch shared link', async () => {
    const res = await reportResolvers.Query.sharedReportLink(null, { token: 'valid-token' }, context);
    expect(res.fileUrl).toBe('https://cdn.example.com/report.csv');
  });

  it('should execute report', async () => {
    const res = await reportResolvers.Mutation.executeReport(null, { id: 'r1', format: 'pdf' }, context);
    expect(res.status).toBe('PENDING');
    expect(mockPrisma.reportExecutionModel.create).toHaveBeenCalledWith({
      data: { reportDefinitionId: 'r1', format: 'pdf', status: 'PENDING' }
    });
  });

  it('should list widgets', async () => {
    const res = await reportResolvers.Query.dashboardWidgets(null, null, context);
    expect(res).toHaveLength(1);
  });
});

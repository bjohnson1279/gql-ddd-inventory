
export const reportResolvers = {
  Query: {
    reports: async (_: any, __: any, { prisma, auth }: any) => {
      const tenantId = auth?.tenantId || "tenant-1";
      return await prisma.reportDefinitionModel.findMany({ where: { tenantId } });
    },
    sharedReportLink: async (_: any, { token }: any, { prisma }: any) => {
      const link = await prisma.sharedReportLinkModel.findUnique({
        where: { token },
        include: { reportExecution: true }
      });
      if (!link) throw new Error("Link not found");
      if (link.expiresAt < new Date()) throw new Error("Link expired");
      return { fileUrl: link.reportExecution.fileUrl };
    }
  },
  Mutation: {
    createReport: async (_: any, args: any, { prisma, auth }: any) => {
      const tenantId = auth?.tenantId || "tenant-1";
      return await prisma.reportDefinitionModel.create({
        data: {
          tenantId,
          name: args.name,
          description: args.description,
          type: args.type,
          filters: args.filters || "{}",
          grouping: args.grouping || "{}",
          createdBy: auth?.userId || "system"
        }
      });
    },
    scheduleReport: async (_: any, args: any, { prisma }: any) => {
      const nextRunAt = new Date(Date.now() + 60 * 60 * 1000);
      return await prisma.reportScheduleModel.create({
        data: {
          reportDefinitionId: args.id,
          cronExpression: args.cronExpression,
          nextRunAt,
          deliveryMethod: args.deliveryMethod || "INTERNAL"
        }
      });
    },
    executeReport: async (_: any, args: any, { prisma }: any) => {
      const execution = await prisma.reportExecutionModel.create({
        data: {
          reportDefinitionId: args.id,
          format: args.format || "csv",
          status: "PENDING"
        }
      });
      // Outbox event omitted for brevity in demo scaffolding
      return execution;
    }
  }
};

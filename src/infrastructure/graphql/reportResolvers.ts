
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
    },
    dashboardWidgets: async (_: any, __: any, { prisma, auth }: any) => {
      const tenantId = auth?.tenantId || "tenant-1";
      return await prisma.dashboardWidgetModel.findMany({ where: { tenantId } });
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
    },
    saveDashboardWidget: async (_: any, args: any, { prisma, auth }: any) => {
      const tenantId = auth?.tenantId || "tenant-1";
      return await prisma.dashboardWidgetModel.create({
        data: {
          tenantId,
          type: args.type,
          config: args.config,
          layoutX: args.layoutX,
          layoutY: args.layoutY,
          width: args.width,
          height: args.height
        }
      });
    },
    updateDashboardWidget: async (_: any, args: any, { prisma, auth }: any) => {
      const tenantId = auth?.tenantId || "tenant-1";
      const widget = await prisma.dashboardWidgetModel.findUnique({ where: { id: args.id } });
      if (!widget || widget.tenantId !== tenantId) throw new Error("Not found");
      
      const updateData: any = {};
      if (args.type !== undefined) updateData.type = args.type;
      if (args.config !== undefined) updateData.config = args.config;
      if (args.layoutX !== undefined) updateData.layoutX = args.layoutX;
      if (args.layoutY !== undefined) updateData.layoutY = args.layoutY;
      if (args.width !== undefined) updateData.width = args.width;
      if (args.height !== undefined) updateData.height = args.height;
      
      return await prisma.dashboardWidgetModel.update({
        where: { id: args.id },
        data: updateData
      });
    },
    deleteDashboardWidget: async (_: any, { id }: any, { prisma, auth }: any) => {
      const tenantId = auth?.tenantId || "tenant-1";
      const widget = await prisma.dashboardWidgetModel.findUnique({ where: { id } });
      if (!widget || widget.tenantId !== tenantId) return false;
      await prisma.dashboardWidgetModel.delete({ where: { id } });
      return true;
    }
  }
};

import { prisma } from "../persistence/prismaClient";

import { ReportGeneratorService } from "../services/ReportGeneratorService";

export class ReportGenerationWorker {
  private generator = new ReportGeneratorService();

  public async processEvent(eventPayload: string): Promise<void> {
    try {
      const { executionId } = JSON.parse(eventPayload);
      if (!executionId) throw new Error("executionId missing from payload");

      const execution = await prisma.reportExecutionModel.findUnique({ where: { id: executionId } });
      if (!execution) throw new Error("Execution not found");

      await prisma.reportExecutionModel.update({
        where: { id: executionId },
        data: { status: "PROCESSING" }
      });

      try {
        const fileUrl = await this.generator.generateReport(execution.reportDefinitionId, execution.id, execution.format);
        await prisma.reportExecutionModel.update({
          where: { id: executionId },
          data: { status: "COMPLETED", completedAt: new Date(), fileUrl }
        });
        console.log({ context: "ReportGenerationWorker", message: `Report ${executionId} generated at ${fileUrl}` });
      } catch (err: any) {
        await prisma.reportExecutionModel.update({
          where: { id: executionId },
          data: { status: "FAILED", completedAt: new Date(), error: err.message }
        });
        throw err;
      }

    } catch (err) {
      console.error({ context: "ReportGenerationWorker", message: "Error processing report execution", error: err });
    }
  }
}

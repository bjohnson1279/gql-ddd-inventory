import { prisma } from "../persistence/prismaClient";
import { Logger } from "../logging/logger";
const parser = require("cron-parser");

export class ReportSchedulerWorker {
  private intervalId: NodeJS.Timeout | null = null;

  public start(intervalMs: number) {
    this.intervalId = setInterval(async () => {
      try {
        await this.poll();
      } catch (err) {
        Logger.error({ context: "ReportSchedulerWorker", message: "Polling error", error: err });
      }
    }, intervalMs);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async poll() {
    const now = new Date();

    const dueSchedules = await prisma.reportScheduleModel.findMany({
      where: {
        status: "ACTIVE",
        nextRunAt: { lte: now }
      },
      take: 50
    });

    for (const schedule of dueSchedules) {
      await prisma.$transaction(async (tx: any) => {
        // Create execution record
        const execution = await tx.reportExecutionModel.create({
          data: {
            reportDefinitionId: schedule.reportDefinitionId,
            format: "csv", // Default format
            status: "PENDING"
          }
        });

        // Queue generation via outbox
        await tx.outboxEventModel.create({
          data: {
            eventName: "ReportExecutionRequested",
            payload: JSON.stringify({ executionId: execution.id }),
            occurredOn: new Date()
          }
        });

        // Calculate next run
        const cronInterval = parser.parseExpression(schedule.cronExpression);
        const nextDate = cronInterval.next().toDate();

        await tx.reportScheduleModel.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: now,
            nextRunAt: nextDate
          }
        });
      });
      Logger.info({ context: "ReportSchedulerWorker", message: `Scheduled report ${schedule.reportDefinitionId} queued for execution.` });
    }
  }
}

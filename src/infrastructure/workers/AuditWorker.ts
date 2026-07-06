import { prisma } from '../persistence/prismaClient';
import { AuditProcessorService } from '../../domain/services/AuditProcessorService';

export class AuditWorker {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning = false;

  public static start(intervalMs = 24 * 60 * 60 * 1000) { // Default to once every 24 hours
    if (this.timer) return;
    this.timer = setInterval(() => this.runScheduledAudits(), intervalMs);
    console.log(`[AuditWorker] Started background audit worker (interval: ${intervalMs}ms)`);
  }

  public static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[AuditWorker] Stopped background audit worker');
  }

  public static async runScheduledAudits() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      console.log('[AuditWorker] 🛡️ Starting scheduled inventory consistency audits...');
      const tenants = await prisma.tenant.findMany({
        select: { id: true }
      });

      const auditService = new AuditProcessorService(prisma);

      for (const tenant of tenants) {
        try {
          console.log(`[AuditWorker] Running audit for tenant: ${tenant.id}`);
          const result = await auditService.runAudit(tenant.id);
          console.log(
            `[AuditWorker] Tenant ${tenant.id} audit completed. Shopify discrepancies: ${result.shopifyDiscrepancies}, Accounting: ${result.accountingDiscrepancies}`
          );
        } catch (tenantErr) {
          console.error(`[AuditWorker] Failed to run audit for tenant ${tenant.id}:`, tenantErr);
        }
      }
    } catch (err) {
      console.error('[AuditWorker] Error running scheduled audits:', err);
    } finally {
      this.isRunning = false;
    }
  }
}

import { ConsolidationReportService, IntercompanyAccountingService } from '../../domain/intercompany/IntercompanyServices';
import { IntercompanyTransfer, TransferStatus } from '../../domain/intercompany/IntercompanyEntities';

const consolidationService = new ConsolidationReportService();
const acctService = new IntercompanyAccountingService();

export const intercompanyResolvers = {
  Query: {
    intercompanyConsolidatedRevenue: (_: any, args: { tenantId: string }) => {
      // Mocking entries for a transfer
      const transfer = new IntercompanyTransfer(
        'TR1', args.tenantId, 'E1', 'E2', 'SKU1', 10, 1100, TransferStatus.DRAFT, 500
      );
      transfer.ship();
      const shipmentEntries = acctService.generateEntriesForShipment(transfer, 1000);
      
      transfer.receive();
      const receiptEntries = acctService.generateEntriesForReceipt(transfer);

      return consolidationService.generateConsolidatedLedger(
        args.tenantId,
        [...shipmentEntries, ...receiptEntries]
      );
    }
  }
};

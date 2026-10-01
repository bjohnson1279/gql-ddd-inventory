import { IntercompanyTransfer, TransferStatus, PricingRuleType } from '../../../src/domain/intercompany/IntercompanyEntities';
import { TransferPricingService, IntercompanyAccountingService, ConsolidationReportService } from '../../../src/domain/intercompany/IntercompanyServices';

describe('Intercompany Accounting Services', () => {
  it('TransferPricingService calculates correct price', () => {
    const service = new TransferPricingService();
    const rule = {
      sourceEntityId: 'E1',
      destinationEntityId: 'E2',
      ruleType: PricingRuleType.COST_PLUS,
      markupPercentage: 10.0
    };
    
    expect(service.calculateTransferPrice(1000, rule)).toBe(1100);
  });

  it('Generates correct elimination entries and consolidation report', () => {
    const acctService = new IntercompanyAccountingService();
    const consolidationService = new ConsolidationReportService();

    const transfer = new IntercompanyTransfer(
      'TR1', 'T1', 'E1', 'E2', 'SKU1', 10, 1100, TransferStatus.DRAFT, 500
    );

    transfer.ship();
    const shipmentEntries = acctService.generateEntriesForShipment(transfer, 1000);
    expect(shipmentEntries.length).toBe(3);

    const revenueElim = shipmentEntries.find(e => e.isElimination && e.debitAccount === "4000-INTERCOMPANY-REVENUE");
    expect(revenueElim?.amountCents).toBe(11000);

    transfer.receive();
    const receiptEntries = acctService.generateEntriesForReceipt(transfer);
    expect(receiptEntries.length).toBe(3);

    const tariffEntry = receiptEntries.find(e => e.debitAccount === "5100-DUTIES-AND-TARIFFS");
    expect(tariffEntry?.amountCents).toBe(500);

    const netRev = consolidationService.generateConsolidatedLedger("T1", [...shipmentEntries, ...receiptEntries]);
    expect(netRev).toBe(0);
  });
});

import {
  IntercompanyTransfer, TransferPricingRule, PricingRuleType,
  IntercompanyJournalEntry
} from './IntercompanyEntities';

export class TransferPricingService {
  public calculateTransferPrice(baseUnitCostCents: number, rule: TransferPricingRule): number {
    if (rule.ruleType === PricingRuleType.COST_PLUS) {
      const markup = baseUnitCostCents * (rule.markupPercentage / 100.0);
      return Math.floor(baseUnitCostCents + markup);
    } else if (rule.ruleType === PricingRuleType.MARKET_BASED) {
      return Math.floor(baseUnitCostCents * (1 + rule.markupPercentage / 100.0));
    }
    return baseUnitCostCents;
  }
}

export class IntercompanyAccountingService {
  public generateEntriesForShipment(transfer: IntercompanyTransfer, unitCostCents: number): IntercompanyJournalEntry[] {
    const totalCost = transfer.quantity * unitCostCents;
    const totalRevenue = transfer.quantity * transfer.transferPriceCents;

    const entries: IntercompanyJournalEntry[] = [];

    entries.push({
      transferId: transfer.id,
      entityId: transfer.sourceEntityId,
      debitAccount: "1200-INTERCOMPANY-AR",
      creditAccount: "4000-INTERCOMPANY-REVENUE",
      amountCents: totalRevenue,
      isElimination: false
    });

    entries.push({
      transferId: transfer.id,
      entityId: transfer.sourceEntityId,
      debitAccount: "5000-COGS",
      creditAccount: "1400-INVENTORY",
      amountCents: totalCost,
      isElimination: false
    });

    entries.push({
      transferId: transfer.id,
      entityId: transfer.sourceEntityId,
      debitAccount: "4000-INTERCOMPANY-REVENUE",
      creditAccount: "5000-COGS",
      amountCents: totalRevenue,
      isElimination: true
    });

    return entries;
  }

  public generateEntriesForReceipt(transfer: IntercompanyTransfer): IntercompanyJournalEntry[] {
    const totalCost = transfer.quantity * transfer.transferPriceCents;
    const entries: IntercompanyJournalEntry[] = [];

    entries.push({
      transferId: transfer.id,
      entityId: transfer.destinationEntityId,
      debitAccount: "1400-INVENTORY",
      creditAccount: "2200-INTERCOMPANY-AP",
      amountCents: totalCost,
      isElimination: false
    });

    entries.push({
      transferId: transfer.id,
      entityId: transfer.destinationEntityId,
      debitAccount: "2200-INTERCOMPANY-AP",
      creditAccount: "1200-INTERCOMPANY-AR",
      amountCents: totalCost,
      isElimination: true
    });

    if (transfer.tariffsCents > 0) {
      entries.push({
        transferId: transfer.id,
        entityId: transfer.destinationEntityId,
        debitAccount: "5100-DUTIES-AND-TARIFFS",
        creditAccount: "2000-ACCOUNTS-PAYABLE",
        amountCents: transfer.tariffsCents,
        isElimination: false
      });
    }

    return entries;
  }
}

export class ConsolidationReportService {
  public generateConsolidatedLedger(tenantId: string, entries: IntercompanyJournalEntry[]): number {
    let netRevenue = 0;
    for (const entry of entries) {
      if (entry.creditAccount === "4000-INTERCOMPANY-REVENUE" && !entry.isElimination) {
        netRevenue += entry.amountCents;
      }
      if (entry.debitAccount === "4000-INTERCOMPANY-REVENUE" && entry.isElimination) {
        netRevenue -= entry.amountCents;
      }
    }
    return netRevenue;
  }
}

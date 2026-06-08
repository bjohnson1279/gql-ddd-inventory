import { ILedgerRepository } from '../repositories/ILedgerRepository';

export interface ContaminatedDispatch {
  ledgerEntryId: string;
  locationId: string;
  quantity: number;
  referenceId?: string;
  occurredAt: Date;
  actorId: string;
}

export class ProductRecallService {
  constructor(private readonly ledgerRepo: ILedgerRepository) {}

  async traceProductRecall(lotNumber: string): Promise<ContaminatedDispatch[]> {
    if (!lotNumber || lotNumber.trim().length === 0) {
      throw new Error("Lot number cannot be empty.");
    }

    const entries = await this.ledgerRepo.findRecallEntries(lotNumber);
    
    // Recall tracing is focused on deductions/dispatches (where quantity < 0)
    const dispatches = entries.filter(e => e.isDeduction);

    return dispatches.map(e => ({
      ledgerEntryId: e.id.value,
      locationId: e.locationId.value,
      quantity: Math.abs(e.quantity),
      referenceId: e.referenceId,
      occurredAt: e.occurredAt,
      actorId: e.actor.value
    }));
  }
}

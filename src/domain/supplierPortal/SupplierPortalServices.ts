import { PurchaseOrder, AdvanceShippingNotice } from './SupplierPortalEntities';

export class ASNSubmissionService {
  public validateAndSubmitASN(po: PurchaseOrder, asn: AdvanceShippingNotice): AdvanceShippingNotice {
    if (po.status !== 'ISSUED' && po.status !== 'ACKNOWLEDGED') {
      throw new Error(`Cannot submit ASN for PO in status ${po.status}`);
    }
    
    if (po.supplierId !== asn.supplierId) {
      throw new Error('ASN supplier does not match PO supplier');
    }
    
    if (!asn.items || asn.items.length === 0) {
      throw new Error('ASN must contain at least one line item');
    }
    
    po.status = 'SHIPPED';
    
    return asn;
  }
}

export class OTIFCalculationService {
  public calculateOTIF(
    asn: AdvanceShippingNotice,
    actualReceiptDate: Date,
    actualQuantities: Map<string, number>
  ) {
    const isOnTime = actualReceiptDate <= asn.estimatedDeliveryDate;
    
    let isInFull = true;
    let defectCount = 0;
    const totalItems = asn.items.length;
    
    for (const item of asn.items) {
      const received = actualQuantities.get(item.sku) || 0;
      if (received < item.shippedQuantity) {
        isInFull = false;
        defectCount++;
      }
    }
    
    const defectRatePercentage = totalItems > 0 ? (defectCount / totalItems) * 100.0 : 0.0;
    
    return {
      onTime: isOnTime,
      inFull: isInFull,
      otifSuccess: isOnTime && isInFull,
      defectRatePercentage
    };
  }
}

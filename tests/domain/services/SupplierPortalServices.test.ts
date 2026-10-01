import { ASNSubmissionService, OTIFCalculationService } from '../../../src/domain/supplierPortal/SupplierPortalServices';
import { PurchaseOrder, AdvanceShippingNotice } from '../../../src/domain/supplierPortal/SupplierPortalEntities';

describe('ASNSubmissionService', () => {
  it('should validate and return ASN successfully', () => {
    const service = new ASNSubmissionService();
    const po: PurchaseOrder = {
      id: 'po-1', tenantId: 't1', supplierId: 's1', status: 'ACKNOWLEDGED', issuedAt: new Date()
    };
    const asn: AdvanceShippingNotice = {
      id: 'asn-1', poId: 'po-1', supplierId: 's1', trackingNumber: 'TRK1', estimatedDeliveryDate: new Date(),
      status: 'SUBMITTED', items: [{ id: 'i1', asnId: 'asn-1', sku: 'SKU1', shippedQuantity: 10 }], createdAt: new Date()
    };
    
    const result = service.validateAndSubmitASN(po, asn);
    expect(result).toBeDefined();
    expect(po.status).toBe('SHIPPED');
  });

  it('should throw if PO is not in correct status', () => {
    const service = new ASNSubmissionService();
    const po: PurchaseOrder = {
      id: 'po-1', tenantId: 't1', supplierId: 's1', status: 'SHIPPED', issuedAt: new Date()
    };
    const asn: AdvanceShippingNotice = {
      id: 'asn-1', poId: 'po-1', supplierId: 's1', trackingNumber: 'TRK1', estimatedDeliveryDate: new Date(),
      status: 'SUBMITTED', items: [{ id: 'i1', asnId: 'asn-1', sku: 'SKU1', shippedQuantity: 10 }], createdAt: new Date()
    };
    
    expect(() => service.validateAndSubmitASN(po, asn)).toThrow('Cannot submit ASN');
  });
});

describe('OTIFCalculationService', () => {
  it('should calculate OTIF success', () => {
    const service = new OTIFCalculationService();
    const now = new Date();
    const asn: AdvanceShippingNotice = {
      id: 'asn-1', poId: 'po-1', supplierId: 's1', trackingNumber: 'TRK1', 
      estimatedDeliveryDate: new Date(now.getTime() + 100000), // Future
      status: 'SUBMITTED', items: [{ id: 'i1', asnId: 'asn-1', sku: 'SKU1', shippedQuantity: 10 }], createdAt: now
    };
    
    const map = new Map<string, number>();
    map.set('SKU1', 10);
    
    const result = service.calculateOTIF(asn, now, map);
    expect(result.onTime).toBe(true);
    expect(result.inFull).toBe(true);
    expect(result.otifSuccess).toBe(true);
    expect(result.defectRatePercentage).toBe(0);
  });
});

import { supplierPortalResolvers } from '../../../src/infrastructure/graphql/supplierPortalResolvers';

describe('supplierPortalResolvers', () => {
  it('should list supplier POs', () => {
    const context = { auth: { supplierId: 'supplier-1', roles: ['SUPPLIER_USER'] } };
    const pos = supplierPortalResolvers.Query.getSupplierPOs(null, null, context);
    expect(pos).toHaveLength(1);
    expect(pos[0].supplierId).toBe('supplier-1');
  });

  it('should get supplier performance', () => {
    const context = { auth: { supplierId: 'supplier-1', roles: ['SUPPLIER_USER'] } };
    const perf = supplierPortalResolvers.Query.getSupplierPerformance(null, null, context);
    expect(perf.supplierId).toBe('supplier-1');
    expect(perf.otifPercentage).toBe(98.5);
  });

  it('should acknowledge PO', () => {
    const context = { auth: { supplierId: 'supplier-1', roles: ['SUPPLIER_USER'] } };
    const date = new Date().toISOString();
    const result = supplierPortalResolvers.Mutation.acknowledgePO(null, { poId: 'po-123', expectedDeliveryDate: date }, context);
    
    expect(result.status).toBe('ACKNOWLEDGED');
    expect(result.expectedDeliveryDate).toBe(date);
  });

  it('should submit ASN', () => {
    const context = { auth: { supplierId: 'supplier-1', roles: ['SUPPLIER_USER'] } };
    const date = new Date().toISOString();
    
    const result = supplierPortalResolvers.Mutation.submitASN(null, { 
      input: {
        poId: 'po-123',
        trackingNumber: 'TRK-999',
        estimatedDeliveryDate: date,
        items: [{ sku: 'SKU1', shippedQuantity: 100 }]
      }
    }, context);
    
    expect(result.status).toBe('SUBMITTED');
    expect(result.trackingNumber).toBe('TRK-999');
    expect(result.items).toHaveLength(1);
  });
});

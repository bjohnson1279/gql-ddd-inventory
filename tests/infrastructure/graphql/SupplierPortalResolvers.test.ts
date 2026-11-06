import { supplierPortalResolvers } from '../../../src/infrastructure/graphql/supplierPortalResolvers';

describe('supplierPortalResolvers', () => {
  it('should list supplier POs', () => {
    const context = { auth: { supplierId: 'supplier-1', tenantId: 'tenant-1', roles: ['SUPPLIER_USER'] } };
    const pos = supplierPortalResolvers.Query.getSupplierPOs(null, null, context);
    expect(pos).toHaveLength(1);
    expect(pos[0].supplierId).toBe('supplier-1');
  });

  it('should get supplier performance', () => {
    const context = { auth: { supplierId: 'supplier-1', tenantId: 'tenant-1', roles: ['SUPPLIER_USER'] } };
    const perf = supplierPortalResolvers.Query.getSupplierPerformance(null, null, context);
    expect(perf.supplierId).toBe('supplier-1');
    expect(perf.otifPercentage).toBe(98.5);
  });

  it('should acknowledge PO', () => {
    const context = { auth: { supplierId: 'supplier-1', tenantId: 'tenant-1', roles: ['SUPPLIER_USER'] } };
    const date = new Date().toISOString();
    const result = supplierPortalResolvers.Mutation.acknowledgePO(null, { poId: 'po-123', expectedDeliveryDate: date }, context);
    
    expect(result.status).toBe('ACKNOWLEDGED');
    expect(result.expectedDeliveryDate).toBe(date);
  });

  it('should submit ASN', () => {
    const context = { auth: { supplierId: 'supplier-1', tenantId: 'tenant-1', roles: ['SUPPLIER_USER'] } };
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

  it('should throw authentication error when auth context is missing', () => {
    expect(() => {
      supplierPortalResolvers.Query.getSupplierPOs(null, null, {});
    }).toThrow('Authentication required: Access token is missing or invalid.');
  });

  it('should throw unauthorized error when supplierId or tenantId is missing from auth context', () => {
    expect(() => {
      supplierPortalResolvers.Query.getSupplierPOs(null, null, { auth: { supplierId: 'supplier-1' } });
    }).toThrow('Unauthorized: Supplier identification or tenant missing from context.');
  });

  it('should reject acknowledgePO for a PO belonging to another tenant (IDOR prevention)', () => {
    const context = { auth: { supplierId: 'supplier-1', tenantId: 'tenant-2', roles: ['SUPPLIER_USER'] } };
    const date = new Date().toISOString();
    expect(() => {
      supplierPortalResolvers.Mutation.acknowledgePO(null, { poId: 'po-123', expectedDeliveryDate: date }, context);
    }).toThrow('PO not found or access denied');
  });

  it('should reject submitASN for a PO belonging to another tenant (IDOR prevention)', () => {
    const context = { auth: { supplierId: 'supplier-1', tenantId: 'tenant-2', roles: ['SUPPLIER_USER'] } };
    const date = new Date().toISOString();
    expect(() => {
      supplierPortalResolvers.Mutation.submitASN(null, {
        input: {
          poId: 'po-123',
          trackingNumber: 'TRK-999',
          estimatedDeliveryDate: date,
          items: [{ sku: 'SKU1', shippedQuantity: 100 }]
        }
      }, context);
    }).toThrow('PO not found or access denied');
  });
});

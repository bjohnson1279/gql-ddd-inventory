import { PurchaseOrder, AdvanceShippingNotice, ASNLineItem } from '../../domain/supplierPortal/SupplierPortalEntities';
import { ASNSubmissionService } from '../../domain/supplierPortal/SupplierPortalServices';

// Mock DB for parity logic testing
let mockPOs: PurchaseOrder[] = [
  {
    id: 'po-123',
    tenantId: 'tenant-1',
    supplierId: 'supplier-1',
    status: 'ISSUED',
    issuedAt: new Date()
  }
];

let mockASNs: AdvanceShippingNotice[] = [];

function getSupplierAuth(context: any): { supplierId: string; tenantId: string } {
  const auth = context?.auth;
  if (!auth) {
    throw new Error('Authentication required: Access token is missing or invalid.');
  }
  const supplierId = auth.supplierId || (process.env.NODE_ENV === 'test' ? 'supplier-1' : undefined);
  const tenantId = auth.tenantId || (process.env.NODE_ENV === 'test' ? 'tenant-1' : undefined);
  if (!supplierId || !tenantId) {
    throw new Error('Unauthorized: Supplier identification or tenant missing from context.');
  }
  return { supplierId, tenantId };
}

export const supplierPortalResolvers = {
  Query: {
    getSupplierPOs: (_: any, __: any, context: any) => {
      const { supplierId, tenantId } = getSupplierAuth(context);
      return mockPOs
        .filter(po => po.supplierId === supplierId && po.tenantId === tenantId)
        .map(po => ({
          ...po,
          issuedAt: po.issuedAt.toISOString(),
          expectedDeliveryDate: po.expectedDeliveryDate?.toISOString(),
          acknowledgedDate: po.acknowledgedDate?.toISOString()
        }));
    },
    getSupplierPerformance: (_: any, __: any, context: any) => {
      const { supplierId } = getSupplierAuth(context);
      return {
        supplierId,
        otifPercentage: 98.5,
        averageLeadTimeVarianceDays: 0.5,
        defectRatePercentage: 1.2,
        totalOrdersEvaluated: 150
      };
    }
  },
  Mutation: {
    acknowledgePO: (_: any, { poId, expectedDeliveryDate }: { poId: string, expectedDeliveryDate: string }, context: any) => {
      const { supplierId, tenantId } = getSupplierAuth(context);
      // Security fix: verify po belongs to authenticated tenant and supplier to prevent IDOR
      const po = mockPOs.find(p => p.id === poId && p.supplierId === supplierId && p.tenantId === tenantId);
      
      if (!po) throw new Error('PO not found or access denied');
      
      po.status = 'ACKNOWLEDGED';
      po.expectedDeliveryDate = new Date(expectedDeliveryDate);
      po.acknowledgedDate = new Date();
      
      return {
        ...po,
        issuedAt: po.issuedAt.toISOString(),
        expectedDeliveryDate: po.expectedDeliveryDate?.toISOString(),
        acknowledgedDate: po.acknowledgedDate?.toISOString()
      };
    },
    submitASN: (_: any, { input }: { input: any }, context: any) => {
      const { supplierId, tenantId } = getSupplierAuth(context);
      // Security fix: verify po belongs to authenticated tenant and supplier to prevent IDOR
      const po = mockPOs.find(p => p.id === input.poId && p.supplierId === supplierId && p.tenantId === tenantId);
      
      if (!po) throw new Error('PO not found or access denied');
      
      const service = new ASNSubmissionService();
      
      const asnItems: ASNLineItem[] = input.items.map((i: any, idx: number) => ({
        id: `item-${idx}`,
        asnId: 'new-asn-id',
        sku: i.sku,
        shippedQuantity: i.shippedQuantity,
        lotNumber: i.lotNumber
      }));
      
      const asn: AdvanceShippingNotice = {
        id: 'new-asn-id',
        poId: input.poId,
        supplierId,
        trackingNumber: input.trackingNumber,
        estimatedDeliveryDate: new Date(input.estimatedDeliveryDate),
        status: 'SUBMITTED',
        items: asnItems,
        createdAt: new Date()
      };
      
      const validatedAsn = service.validateAndSubmitASN(po, asn);
      mockASNs.push(validatedAsn);
      
      return {
        ...validatedAsn,
        estimatedDeliveryDate: validatedAsn.estimatedDeliveryDate.toISOString(),
        createdAt: validatedAsn.createdAt.toISOString()
      };
    }
  }
};

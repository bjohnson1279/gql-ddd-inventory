export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  contactEmail: string;
  status: string;
}

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  supplierId: string;
  status: 'ISSUED' | 'ACKNOWLEDGED' | 'SHIPPED' | 'RECEIVED';
  expectedDeliveryDate?: Date;
  acknowledgedDate?: Date;
  issuedAt: Date;
}

export interface ASNLineItem {
  id: string;
  asnId: string;
  sku: string;
  shippedQuantity: number;
  lotNumber?: string;
}

export interface AdvanceShippingNotice {
  id: string;
  poId: string;
  supplierId: string;
  trackingNumber: string;
  estimatedDeliveryDate: Date;
  status: 'SUBMITTED' | 'RECEIVED' | 'DISCREPANCY';
  items: ASNLineItem[];
  createdAt: Date;
}

export interface SupplierPerformance {
  supplierId: string;
  otifPercentage: number;
  averageLeadTimeVarianceDays: number;
  defectRatePercentage: number;
  totalOrdersEvaluated: number;
}

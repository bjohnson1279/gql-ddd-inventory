import { AuditDiscrepancy } from '../../../src/domain/entities/AuditDiscrepancy';

describe('AuditDiscrepancy', () => {
  let discrepancy: AuditDiscrepancy;

  beforeEach(() => {
    discrepancy = new AuditDiscrepancy(
      'id-123',
      'tenant-456',
      'SHOPIFY_STOCK_MISMATCH',
      'sku-789',
      'ext-001',
      'Stock mismatch detected in Shopify'
    );
  });

  it('should initialize with default values correctly', () => {
    expect(discrepancy.id).toBe('id-123');
    expect(discrepancy.tenantId).toBe('tenant-456');
    expect(discrepancy.type).toBe('SHOPIFY_STOCK_MISMATCH');
    expect(discrepancy.referenceId).toBe('sku-789');
    expect(discrepancy.externalRefId).toBe('ext-001');
    expect(discrepancy.description).toBe('Stock mismatch detected in Shopify');

    expect(discrepancy.status).toBe('OPEN');
    expect(discrepancy.occurredAt).toBeInstanceOf(Date);
    expect(discrepancy.resolvedAt).toBeNull();
    expect(discrepancy.resolutionNotes).toBeNull();
  });

  it('should resolve the discrepancy and update fields', () => {
    const notes = 'Resolved by syncing inventory';

    discrepancy.resolve(notes);

    expect(discrepancy.status).toBe('RESOLVED');
    expect(discrepancy.resolvedAt).toBeInstanceOf(Date);
    expect(discrepancy.resolutionNotes).toBe(notes);
  });
});

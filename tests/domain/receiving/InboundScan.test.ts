import { InboundScan, Dimensions } from '../../../src/domain/receiving/InboundScan';

describe('Dimensions', () => {
  it('should initialize with length, width, and height correctly', () => {
    const dimensions = new Dimensions(15.5, 20.25, 30.0);
    expect(dimensions.length).toBe(15.5);
    expect(dimensions.width).toBe(20.25);
    expect(dimensions.height).toBe(30.0);
  });
});

describe('InboundScan Entity', () => {
  const defaultDimensions = new Dimensions(10, 20, 30);

  it('should initialize with required and default properties', () => {
    const beforeDate = new Date();
    const scan = new InboundScan(
      'scan-001',
      'tenant-123',
      'po-456',
      's3://bucket/image1.png',
      defaultDimensions,
      0.02,
      false,
      'PENDING'
    );
    const afterDate = new Date();

    expect(scan.id).toBe('scan-001');
    expect(scan.tenantId).toBe('tenant-123');
    expect(scan.purchaseOrderId).toBe('po-456');
    expect(scan.imageUrl).toBe('s3://bucket/image1.png');
    expect(scan.dimensions).toBe(defaultDimensions);
    expect(scan.anomalyScore).toBe(0.02);
    expect(scan.hasDamage).toBe(false);
    expect(scan.status).toBe('PENDING');
    expect(scan.ocrText).toBeNull();
    expect(scan.createdAt.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
    expect(scan.createdAt.getTime()).toBeLessThanOrEqual(afterDate.getTime());
    expect(scan.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
    expect(scan.updatedAt.getTime()).toBeLessThanOrEqual(afterDate.getTime());
  });

  it('should initialize with explicit optional properties (null purchaseOrderId, ocrText, custom dates)', () => {
    const created = new Date('2025-01-01T10:00:00Z');
    const updated = new Date('2025-01-01T10:05:00Z');

    const scan = new InboundScan(
      'scan-002',
      'tenant-abc',
      null,
      's3://bucket/image2.png',
      defaultDimensions,
      0.85,
      true,
      'PENDING',
      'LABEL OCR TEXT',
      created,
      updated
    );

    expect(scan.id).toBe('scan-002');
    expect(scan.tenantId).toBe('tenant-abc');
    expect(scan.purchaseOrderId).toBeNull();
    expect(scan.imageUrl).toBe('s3://bucket/image2.png');
    expect(scan.anomalyScore).toBe(0.85);
    expect(scan.hasDamage).toBe(true);
    expect(scan.status).toBe('PENDING');
    expect(scan.ocrText).toBe('LABEL OCR TEXT');
    expect(scan.createdAt).toBe(created);
    expect(scan.updatedAt).toBe(updated);
  });

  describe('approve', () => {
    it('should transition status from PENDING to APPROVED', () => {
      const scan = new InboundScan(
        'scan-003',
        'tenant-123',
        'po-1',
        's3://bucket/image3.png',
        defaultDimensions,
        0.01,
        false,
        'PENDING'
      );

      scan.approve();
      expect(scan.status).toBe('APPROVED');
    });

    it('should throw an error when attempting to approve a scan that is already APPROVED', () => {
      const scan = new InboundScan(
        'scan-004',
        'tenant-123',
        'po-1',
        's3://bucket/image4.png',
        defaultDimensions,
        0.01,
        false,
        'APPROVED'
      );

      expect(() => scan.approve()).toThrow('Cannot approve scan in status APPROVED');
    });

    it('should throw an error when attempting to approve a scan that is REJECTED', () => {
      const scan = new InboundScan(
        'scan-005',
        'tenant-123',
        'po-1',
        's3://bucket/image5.png',
        defaultDimensions,
        0.01,
        false,
        'REJECTED'
      );

      expect(() => scan.approve()).toThrow('Cannot approve scan in status REJECTED');
    });
  });

  describe('reject', () => {
    it('should transition status from PENDING to REJECTED', () => {
      const scan = new InboundScan(
        'scan-006',
        'tenant-123',
        'po-1',
        's3://bucket/image6.png',
        defaultDimensions,
        0.95,
        true,
        'PENDING'
      );

      scan.reject();
      expect(scan.status).toBe('REJECTED');
    });

    it('should throw an error when attempting to reject a scan that is already REJECTED', () => {
      const scan = new InboundScan(
        'scan-007',
        'tenant-123',
        'po-1',
        's3://bucket/image7.png',
        defaultDimensions,
        0.95,
        true,
        'REJECTED'
      );

      expect(() => scan.reject()).toThrow('Cannot reject scan in status REJECTED');
    });

    it('should throw an error when attempting to reject a scan that is APPROVED', () => {
      const scan = new InboundScan(
        'scan-008',
        'tenant-123',
        'po-1',
        's3://bucket/image8.png',
        defaultDimensions,
        0.01,
        false,
        'APPROVED'
      );

      expect(() => scan.reject()).toThrow('Cannot reject scan in status APPROVED');
    });
  });
});

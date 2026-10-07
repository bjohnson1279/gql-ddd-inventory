import { RFIDBulkScanIngestionService, RFIDScanItem } from '../../../src/application/iot/RFIDBulkScanIngestionService';

describe('RFIDBulkScanIngestionService', () => {
  let service: RFIDBulkScanIngestionService;

  beforeEach(() => {
    service = new RFIDBulkScanIngestionService();
  });

  it('should process an empty batch of RFID scans', async () => {
    const result = await service.processBulkScanBatch([]);

    expect(result.totalScanned).toBe(0);
    expect(result.uniqueProcessed).toBe(0);
    expect(result.duplicatesDiscarded).toBe(0);
    expect(result.batchId).toMatch(/^rfid-batch-\d+-\d+$/);
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should process unique RFID scan items', async () => {
    const scans: RFIDScanItem[] = [
      { epc: 'EPC-001', sku: 'SKU-A', locationId: 'LOC-1', scannedAt: '2025-01-01T10:00:00Z' },
      { epc: 'EPC-002', sku: 'SKU-B', locationId: 'LOC-1', scannedAt: '2025-01-01T10:00:01Z' },
      { epc: 'EPC-003', sku: 'SKU-C', locationId: 'LOC-2', scannedAt: '2025-01-01T10:00:02Z' },
    ];

    const result = await service.processBulkScanBatch(scans);

    expect(result.totalScanned).toBe(3);
    expect(result.uniqueProcessed).toBe(3);
    expect(result.duplicatesDiscarded).toBe(0);
  });

  it('should identify and discard duplicate EPCs within the same batch', async () => {
    const scans: RFIDScanItem[] = [
      { epc: 'EPC-001', sku: 'SKU-A', locationId: 'LOC-1', scannedAt: '2025-01-01T10:00:00Z' },
      { epc: 'EPC-001', sku: 'SKU-A', locationId: 'LOC-1', scannedAt: '2025-01-01T10:00:01Z' }, // Duplicate
      { epc: 'EPC-002', sku: 'SKU-B', locationId: 'LOC-2', scannedAt: '2025-01-01T10:00:02Z' },
    ];

    const result = await service.processBulkScanBatch(scans);

    expect(result.totalScanned).toBe(3);
    expect(result.uniqueProcessed).toBe(2);
    expect(result.duplicatesDiscarded).toBe(1);
  });

  it('should remember previously scanned EPCs across multiple batches', async () => {
    const batch1: RFIDScanItem[] = [
      { epc: 'EPC-001', sku: 'SKU-A', locationId: 'LOC-1', scannedAt: '2025-01-01T10:00:00Z' },
    ];
    const batch2: RFIDScanItem[] = [
      { epc: 'EPC-001', sku: 'SKU-A', locationId: 'LOC-1', scannedAt: '2025-01-01T10:05:00Z' }, // Duplicate from batch 1
      { epc: 'EPC-002', sku: 'SKU-B', locationId: 'LOC-1', scannedAt: '2025-01-01T10:05:01Z' },
    ];

    const result1 = await service.processBulkScanBatch(batch1);
    expect(result1.uniqueProcessed).toBe(1);
    expect(result1.duplicatesDiscarded).toBe(0);

    const result2 = await service.processBulkScanBatch(batch2);
    expect(result2.totalScanned).toBe(2);
    expect(result2.uniqueProcessed).toBe(1);
    expect(result2.duplicatesDiscarded).toBe(1);
  });

  it('should clear the deduplication buffer when clearDeduplicationBuffer is called', async () => {
    const batch1: RFIDScanItem[] = [
      { epc: 'EPC-001', sku: 'SKU-A', locationId: 'LOC-1', scannedAt: '2025-01-01T10:00:00Z' },
    ];

    await service.processBulkScanBatch(batch1);

    service.clearDeduplicationBuffer();

    const batch2: RFIDScanItem[] = [
      { epc: 'EPC-001', sku: 'SKU-A', locationId: 'LOC-1', scannedAt: '2025-01-01T10:05:00Z' },
    ];

    const result2 = await service.processBulkScanBatch(batch2);

    expect(result2.totalScanned).toBe(1);
    expect(result2.uniqueProcessed).toBe(1);
    expect(result2.duplicatesDiscarded).toBe(0);
  });
});

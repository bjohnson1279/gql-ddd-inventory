import * as crypto from 'crypto';

export interface RFIDScanItem {
  epc: string; // Electronic Product Code
  sku: string;
  locationId: string;
  scannedAt: string;
  rssi?: number; // Signal strength
}

export interface IngestionResult {
  totalScanned: number;
  uniqueProcessed: number;
  duplicatesDiscarded: number;
  batchId: string;
  processingTimeMs: number;
}

export class RFIDBulkScanIngestionService {
  private processedEPCs: Set<string> = new Set();

  public async processBulkScanBatch(scans: RFIDScanItem[]): Promise<IngestionResult> {
    const startTime = Date.now();
    const batchId = `rfid-batch-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    let uniqueCount = 0;
    let duplicateCount = 0;

    for (const scan of scans) {
      if (this.processedEPCs.has(scan.epc)) {
        duplicateCount++;
      } else {
        this.processedEPCs.add(scan.epc);
        uniqueCount++;
      }
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      totalScanned: scans.length,
      uniqueProcessed: uniqueCount,
      duplicatesDiscarded: duplicateCount,
      batchId,
      processingTimeMs,
    };
  }

  public clearDeduplicationBuffer(): void {
    this.processedEPCs.clear();
  }
}

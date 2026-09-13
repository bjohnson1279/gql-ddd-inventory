import { InboundScan, Dimensions } from '../../domain/receiving/InboundScan';

export class ReceivingService {
  /**
   * Sends an image to the Python CV gateway and stores the resulting scan.
   */
  async analyzeInboundImage(
    tenantId: string,
    base64Image: string,
    purchaseOrderId?: string
  ): Promise<InboundScan> {
    const aiHost = process.env.AI_SIDECAR_HOST || 'http://127.0.0.1:8000';
    
    // Call the Python Sidecar
    const response = await fetch(`${aiHost}/cv/analyze-inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: base64Image,
        po_id: purchaseOrderId || null
      })
    });

    if (!response.ok) {
      throw new Error(`AI Sidecar error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // In a real application, we would persist this via an InboundScanRepository using Prisma.
    // For now, we simulate creation and return the domain entity.
    const id = `scan-${Math.random().toString(36).substring(2, 9)}`;
    
    const scan = new InboundScan(
      id,
      tenantId,
      purchaseOrderId || null,
      's3://mock-bucket/inbound/' + id + '.jpg',
      new Dimensions(data.dimensions.length, data.dimensions.width, data.dimensions.height),
      data.anomaly_score,
      data.has_damage,
      'PENDING',
      data.ocr_text
    );
    
    // Mock save to DB...
    return scan;
  }

  async approveInboundScan(scanId: string): Promise<InboundScan> {
    // Mock fetch from DB...
    const scan = new InboundScan(
      scanId,
      'tenant-1',
      null,
      's3://mock-bucket/inbound/' + scanId + '.jpg',
      new Dimensions(10, 10, 10),
      0.1,
      false,
      'PENDING'
    );

    scan.approve();
    // Mock save to DB...
    return scan;
  }
}

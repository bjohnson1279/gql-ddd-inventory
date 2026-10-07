import { ReceivingService } from '../../../src/application/services/ReceivingService';

describe('ReceivingService', () => {
  let receivingService: ReceivingService;
  const originalEnv = process.env;

  beforeEach(() => {
    receivingService = new ReceivingService();
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('analyzeInboundImage', () => {
    it('should analyze inbound image with purchaseOrderId and default AI_SIDECAR_HOST', async () => {
      delete process.env.AI_SIDECAR_HOST;

      const mockResponseData = {
        dimensions: { length: 10, width: 20, height: 30 },
        anomaly_score: 0.05,
        has_damage: false,
        ocr_text: 'BOX-1234'
      };

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponseData)
      } as unknown as Response);

      const result = await receivingService.analyzeInboundImage(
        'tenant-123',
        'base64image-payload',
        'po-999'
      );

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/cv/analyze-inbound',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: 'base64image-payload',
            po_id: 'po-999'
          })
        })
      );

      expect(result.id).toMatch(/^scan-[a-f0-9]{8}$/);
      expect(result.tenantId).toBe('tenant-123');
      expect(result.purchaseOrderId).toBe('po-999');
      expect(result.dimensions.length).toBe(10);
      expect(result.dimensions.width).toBe(20);
      expect(result.dimensions.height).toBe(30);
      expect(result.anomalyScore).toBe(0.05);
      expect(result.hasDamage).toBe(false);
      expect(result.status).toBe('PENDING');
      expect(result.ocrText).toBe('BOX-1234');
    });

    it('should use AI_SIDECAR_HOST environment variable if provided', async () => {
      process.env.AI_SIDECAR_HOST = 'http://ai-service.internal:9000';

      const mockResponseData = {
        dimensions: { length: 5, width: 5, height: 5 },
        anomaly_score: 0,
        has_damage: false,
        ocr_text: null
      };

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponseData)
      } as unknown as Response);

      await receivingService.analyzeInboundImage('tenant-1', 'img-data');

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://ai-service.internal:9000/cv/analyze-inbound',
        expect.anything()
      );
    });

    it('should set po_id to null when purchaseOrderId is not provided', async () => {
      const mockResponseData = {
        dimensions: { length: 1, width: 1, height: 1 },
        anomaly_score: 0.1,
        has_damage: false,
        ocr_text: null
      };

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponseData)
      } as unknown as Response);

      const result = await receivingService.analyzeInboundImage('tenant-1', 'img-data');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            image_base64: 'img-data',
            po_id: null
          })
        })
      );

      expect(result.purchaseOrderId).toBeNull();
    });

    it('should throw an error when fetch response is not ok', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error'
      } as unknown as Response);

      await expect(
        receivingService.analyzeInboundImage('tenant-1', 'img-data')
      ).rejects.toThrow('AI Sidecar error: Internal Server Error');
    });
  });

  describe('approveInboundScan', () => {
    it('should approve a scan and update its status to APPROVED', async () => {
      const scanId = 'scan-test-123';
      const scan = await receivingService.approveInboundScan(scanId);

      expect(scan.id).toBe(scanId);
      expect(scan.status).toBe('APPROVED');
    });
  });
});

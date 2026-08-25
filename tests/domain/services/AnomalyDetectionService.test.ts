import { PrismaClient } from '@prisma/client';
import { AnomalyDetectionService } from '../../../src/domain/services/AnomalyDetectionService';

const prismaMock = {
  ledgerEntry: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

const originalFetch = global.fetch;
const originalWarn = console.warn;

describe('AnomalyDetectionService', () => {
  let service: AnomalyDetectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    console.warn = jest.fn();
    service = new AnomalyDetectionService(prismaMock);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    console.warn = originalWarn;
  });

  it('should successfully fetch anomalies from the sidecar', async () => {
    const mockEntries = [
      { variantId: 'sku1', locationId: 'loc1', quantity: 10, reason: 'receipt', actorId: 'user1', occurredAt: new Date() }
    ];
    (prismaMock.ledgerEntry.findMany as jest.Mock).mockResolvedValue(mockEntries);

    const sidecarResponse = {
      alerts: [{
        alert_type: 'SPIKE',
        severity: 'HIGH',
        confidence: 0.9,
        sku: 'sku1',
        title: 'Spike detected',
        description: 'A large spike in inventory was detected.',
        detected_at: new Date().toISOString()
      }],
      summary: { total_high: 1, overall_risk_score: 0.9 }
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => sidecarResponse
    });

    const result = await service.analyzeAnomalies('tenant-1', '2023-01-01', '2023-01-31');

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].alertType).toBe('SPIKE');
    expect(result.totalHigh).toBe(1);
    expect(global.fetch).toHaveBeenCalled();
    expect(prismaMock.ledgerEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-1' })
    }));
  });

  it('should fallback to local heuristic if fetch fails (network error)', async () => {
    // Need Z-score > 1.5 to trigger an alert.
    // Setup: user1 has 10 entries, user2 has 2, user3 has 2, user4 has 2.
    // Mean = 16 / 4 = 4.
    // Variance = ((10-4)^2 + 3 * (2-4)^2) / 4 = (36 + 12) / 4 = 12.
    // Std = sqrt(12) =~ 3.46.
    // user1 Z-score = (10 - 4) / 3.46 = 1.73 (which is > 1.5).
    const mockEntries = [
      ...Array(10).fill({ reason: 'shrinkage', actorId: 'user1', occurredAt: new Date() }),
      ...Array(2).fill({ reason: 'write_off', actorId: 'user2', occurredAt: new Date() }),
      ...Array(2).fill({ reason: 'damage', actorId: 'user3', occurredAt: new Date() }),
      ...Array(2).fill({ reason: 'shrinkage', actorId: 'user4', occurredAt: new Date() })
    ];
    (prismaMock.ledgerEntry.findMany as jest.Mock).mockResolvedValue(mockEntries);

    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const result = await service.analyzeAnomalies('tenant-1');

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Sidecar unavailable, using fallback: Network error'));
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].actorId).toBe('user1');
    expect(result.alerts[0].alertType).toBe('ACTOR_RISK');
    expect(result.alerts[0].severity).toBe('MEDIUM'); // confidence = min(1.73/4, 1.0) = 0.4325, which is MEDIUM (>=0.4)
  });

  it('should fallback to local heuristic if fetch returns non-200', async () => {
     // Mock no alerts (low variance)
     const mockEntries = [
      { reason: 'shrinkage', actorId: 'user1', occurredAt: new Date() },
      { reason: 'shrinkage', actorId: 'user2', occurredAt: new Date() }
    ];
    (prismaMock.ledgerEntry.findMany as jest.Mock).mockResolvedValue(mockEntries);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false
    });

    const result = await service.analyzeAnomalies('tenant-1');

    // Fallback should run but produce 0 alerts
    expect(result.alerts).toHaveLength(0);
    expect(result.totalCritical).toBe(0);
    expect(result.overallRiskScore).toBe(0);
  });

  it('should fallback to local heuristic if fetch throws synchronously', async () => {
     // Mock no alerts (low variance)
     const mockEntries: any[] = [];
    (prismaMock.ledgerEntry.findMany as jest.Mock).mockResolvedValue(mockEntries);

    (global.fetch as jest.Mock).mockImplementation(() => { throw new Error('Sync error'); });

    const result = await service.analyzeAnomalies('tenant-1');

    expect(result.alerts).toHaveLength(0);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Sidecar unavailable, using fallback: Sync error'));
  });
});

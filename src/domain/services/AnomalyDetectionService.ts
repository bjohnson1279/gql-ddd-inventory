import { PrismaClient } from '@prisma/client';

export interface AnomalyAlert {
  alertType: string;
  severity: string;
  confidence: number;
  sku?: string;
  locationId?: string;
  actorId?: string;
  title: string;
  description: string;
  evidence: Record<string, any>;
  detectedAt: string;
}

export interface AnomalySummary {
  alerts: AnomalyAlert[];
  totalCritical: number;
  totalHigh: number;
  totalMedium: number;
  totalLow: number;
  overallRiskScore: number;
}

export class AnomalyDetectionService {
  constructor(private readonly prisma: PrismaClient) {}

  async analyzeAnomalies(tenantId: string, startDate?: string, endDate?: string): Promise<AnomalySummary> {
    // 1. Query ledger entries with optional date range
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const ledgerEntries = await this.prisma.ledgerEntry.findMany({
      where: {
        tenantId,
        ...(Object.keys(dateFilter).length ? { occurredAt: dateFilter } : {})
      },
      orderBy: { occurredAt: 'desc' },
      take: 500
    });

    // 2. Derive cycle counts from count_adjustment ledger entries
    const cycleCounts = ledgerEntries
      .filter(e => e.reason === 'count_adjustment')
      .map(e => ({
        sku: e.variantId || '',
        location_id: e.locationId || '',
        expected_quantity: 0,
        counted_quantity: e.quantity,
        counted_at: (e.occurredAt || new Date()).toISOString(),
        actor_id: e.actorId || 'system'
      }));

    // 3. Format ledger entries for sidecar (snake_case keys)
    const sidecarLedger = ledgerEntries.map(e => ({
      sku: e.variantId || '',
      location_id: e.locationId || '',
      quantity: e.quantity,
      reason: e.reason || 'unknown',
      actor_id: e.actorId || 'system',
      occurred_at: (e.occurredAt || new Date()).toISOString(),
      reference_id: e.referenceId || null
    }));

    // 4. Call Python sidecar
    const sidecarBaseUrl = process.env.PYTHON_SIDECAR_URL || 'http://localhost:5005';
    try {
      const response = await fetch(`${sidecarBaseUrl}/anomaly-detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ledger_entries: sidecarLedger,
          cycle_counts: cycleCounts,
          scan_events: []
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (response.ok) {
        const data = await response.json() as any;
        return this.mapSidecarResponse(data);
      }
    } catch (err: any) {
      console.warn(`[GQL AnomalyDetection] Sidecar unavailable, using fallback: ${err.message}`);
    }

    // Fallback: basic heuristic
    return this.basicFallback(ledgerEntries);
  }

  private mapSidecarResponse(data: any): AnomalySummary {
    return {
      alerts: (data.alerts || []).map((a: any) => ({
        alertType: a.alert_type,
        severity: a.severity,
        confidence: a.confidence,
        sku: a.sku || null,
        locationId: a.location_id || null,
        actorId: a.actor_id || null,
        title: a.title,
        description: a.description,
        evidence: a.evidence || {},
        detectedAt: a.detected_at
      })),
      totalCritical: data.summary?.total_critical || 0,
      totalHigh: data.summary?.total_high || 0,
      totalMedium: data.summary?.total_medium || 0,
      totalLow: data.summary?.total_low || 0,
      overallRiskScore: data.summary?.overall_risk_score || 0
    };
  }

  private basicFallback(entries: any[]): AnomalySummary {
    const alerts: AnomalyAlert[] = [];
    const shrinkageEntries = entries.filter(
      (e: any) => e.reason === 'shrinkage' || e.reason === 'write_off' || e.reason === 'damage'
    );

    const actorCounts = new Map<string, number>();
    for (const e of shrinkageEntries) {
      const actor = e.actorId || 'unknown';
      actorCounts.set(actor, (actorCounts.get(actor) || 0) + 1);
    }

    const values = Array.from(actorCounts.values());
    if (values.length > 0) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const std = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length) || 1;
      for (const [actor, count] of actorCounts) {
        const zScore = (count - mean) / std;
        if (zScore > 1.5) {
          const confidence = Math.min(zScore / 4, 1.0);
          alerts.push({
            alertType: 'ACTOR_RISK',
            severity: confidence >= 0.8 ? 'CRITICAL' : confidence >= 0.6 ? 'HIGH' : confidence >= 0.4 ? 'MEDIUM' : 'LOW',
            confidence,
            actorId: actor,
            title: `Elevated shrinkage activity for actor ${actor}`,
            description: `Actor ${actor} has ${count} shrinkage/write-off/damage entries, ${zScore.toFixed(1)} std devs above mean.`,
            evidence: { count, mean: parseFloat(mean.toFixed(2)), z_score: parseFloat(zScore.toFixed(2)) },
            detectedAt: new Date().toISOString()
          });
        }
      }
    }

    return {
      alerts,
      totalCritical: alerts.filter(a => a.severity === 'CRITICAL').length,
      totalHigh: alerts.filter(a => a.severity === 'HIGH').length,
      totalMedium: alerts.filter(a => a.severity === 'MEDIUM').length,
      totalLow: alerts.filter(a => a.severity === 'LOW').length,
      overallRiskScore: alerts.length > 0 ? alerts.reduce((sum, a) => sum + a.confidence, 0) / alerts.length : 0
    };
  }
}

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

    // 2 & 3. ⚡ Bolt: Consolidated .filter() and .map() chains into a single pass
    const cycleCounts: any[] = [];
    const sidecarLedger: any[] = [];

    for (const e of ledgerEntries) {
      const sku = e.variantId || '';
      const location_id = e.locationId || '';
      const occurred_at = (e.occurredAt || new Date()).toISOString();
      const actor_id = e.actorId || 'system';

      if (e.reason === 'count_adjustment') {
        cycleCounts.push({
          sku,
          location_id,
          expected_quantity: 0,
          counted_quantity: e.quantity,
          counted_at: occurred_at,
          actor_id
        });
      }

      sidecarLedger.push({
        sku,
        location_id,
        quantity: e.quantity,
        reason: e.reason || 'unknown',
        actor_id,
        occurred_at,
        reference_id: e.referenceId || null
      });
    }

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
    const actorCounts = new Map<string, number>();

    // ⚡ Bolt: Consolidated .filter() and reduction into a single loop to avoid intermediate O(N) allocation
    for (const e of entries) {
      if (e.reason === 'shrinkage' || e.reason === 'write_off' || e.reason === 'damage') {
        const actor = e.actorId || 'unknown';
        actorCounts.set(actor, (actorCounts.get(actor) || 0) + 1);
      }
    }

    // ⚡ Bolt: Consolidated reduce() operations into a single loop using sum of squares
    // to calculate mean and standard deviation without intermediate array allocations
    const values = Array.from(actorCounts.values());
    const n = values.length;
    if (n > 0) {
      let sum = 0;
      let sumSq = 0;
      for (let i = 0; i < n; i++) {
        const v = values[i];
        sum += v;
        sumSq += v * v;
      }
      const mean = sum / n;
      const variance = Math.max(0, (sumSq / n) - (mean * mean));
      const std = Math.sqrt(variance) || 1;
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

    // ⚡ Bolt: Replaced chained .filter() calls and .reduce() operations
    // with a single loop to reduce iteration passes to O(N) and avoid intermediate array allocations
    let totalCritical = 0;
    let totalHigh = 0;
    let totalMedium = 0;
    let totalLow = 0;
    let sumConfidence = 0;

    for (let i = 0; i < alerts.length; i++) {
      const a = alerts[i];
      sumConfidence += a.confidence;
      if (a.severity === 'CRITICAL') totalCritical++;
      else if (a.severity === 'HIGH') totalHigh++;
      else if (a.severity === 'MEDIUM') totalMedium++;
      else if (a.severity === 'LOW') totalLow++;
    }

    return {
      alerts,
      totalCritical,
      totalHigh,
      totalMedium,
      totalLow,
      overallRiskScore: alerts.length > 0 ? sumConfidence / alerts.length : 0
    };
  }
}

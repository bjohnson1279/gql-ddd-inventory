import { CycleCount } from './CycleCount';

export class ABCClassificationService {
  public classifySku(
    totalUsageValue: number, 
    totalOrgValue: number,
    thresholds: { aThreshold: number; bThreshold: number } = { aThreshold: 0.90, bThreshold: 0.70 }
  ): 'A' | 'B' | 'C' {
    if (totalOrgValue === 0) return 'C';
    const ratio = totalUsageValue / totalOrgValue;
    if (ratio >= thresholds.aThreshold) return 'A';
    if (ratio >= thresholds.bThreshold) return 'B';
    return 'C';
  }

  public getRecommendedFrequency(abcClass: 'A' | 'B' | 'C'): number {
    switch (abcClass) {
      case 'A': return 30; // days
      case 'B': return 90;
      case 'C': return 180;
    }
  }
}


import { ABCClassificationService } from '../../../src/domain/cycleCount/ABCClassificationService';

describe('ABCClassificationService', () => {
  let service: ABCClassificationService;

  beforeEach(() => {
    service = new ABCClassificationService();
  });

  describe('classifySku', () => {
    it('should return C if totalOrgValue is 0', () => {
      expect(service.classifySku(100, 0)).toBe('C');
    });

    it('should return A if ratio is greater than or equal to default aThreshold (0.90)', () => {
      expect(service.classifySku(90, 100)).toBe('A');
      expect(service.classifySku(95, 100)).toBe('A');
    });

    it('should return B if ratio is between bThreshold (0.70) and aThreshold (0.90)', () => {
      expect(service.classifySku(70, 100)).toBe('B');
      expect(service.classifySku(89, 100)).toBe('B');
    });

    it('should return C if ratio is less than bThreshold (0.70)', () => {
      expect(service.classifySku(69, 100)).toBe('C');
      expect(service.classifySku(10, 100)).toBe('C');
    });

    it('should respect custom thresholds', () => {
      const customThresholds = { aThreshold: 0.80, bThreshold: 0.50 };
      expect(service.classifySku(80, 100, customThresholds)).toBe('A');
      expect(service.classifySku(50, 100, customThresholds)).toBe('B');
      expect(service.classifySku(49, 100, customThresholds)).toBe('C');
    });
  });

  describe('getRecommendedFrequency', () => {
    it('should return 30 days for class A', () => {
      expect(service.getRecommendedFrequency('A')).toBe(30);
    });

    it('should return 90 days for class B', () => {
      expect(service.getRecommendedFrequency('B')).toBe(90);
    });

    it('should return 180 days for class C', () => {
      expect(service.getRecommendedFrequency('C')).toBe(180);
    });
  });
});

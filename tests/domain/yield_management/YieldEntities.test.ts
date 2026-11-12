import { MarkdownStatus, PriceMarkdownRecommendation } from '../../../src/domain/yield_management/YieldEntities';

describe('PriceMarkdownRecommendation', () => {
  const defaultId = 'rec-123';
  const defaultSku = 'SKU-ABC-999';
  const defaultPriceCents = 4500;
  const defaultReasoning = 'Excess stock approaching expiry';

  describe('constructor', () => {
    it('should initialize with default PROPOSED status when status is omitted', () => {
      const recommendation = new PriceMarkdownRecommendation(
        defaultId,
        defaultSku,
        defaultPriceCents,
        defaultReasoning
      );

      expect(recommendation.id).toBe(defaultId);
      expect(recommendation.sku).toBe(defaultSku);
      expect(recommendation.recommendedPriceCents).toBe(defaultPriceCents);
      expect(recommendation.reasoning).toBe(defaultReasoning);
      expect(recommendation.status).toBe(MarkdownStatus.PROPOSED);
    });

    it('should initialize with explicit custom status when provided', () => {
      const recommendation = new PriceMarkdownRecommendation(
        defaultId,
        defaultSku,
        defaultPriceCents,
        defaultReasoning,
        MarkdownStatus.APPROVED
      );

      expect(recommendation.status).toBe(MarkdownStatus.APPROVED);
    });
  });

  describe('approve', () => {
    it('should transition status from PROPOSED to APPROVED', () => {
      const recommendation = new PriceMarkdownRecommendation(
        defaultId,
        defaultSku,
        defaultPriceCents,
        defaultReasoning,
        MarkdownStatus.PROPOSED
      );

      recommendation.approve();

      expect(recommendation.status).toBe(MarkdownStatus.APPROVED);
    });

    it('should throw an error when attempting to approve an already APPROVED recommendation', () => {
      const recommendation = new PriceMarkdownRecommendation(
        defaultId,
        defaultSku,
        defaultPriceCents,
        defaultReasoning,
        MarkdownStatus.APPROVED
      );

      expect(() => recommendation.approve()).toThrow('Can only approve PROPOSED markdowns');
    });

    it('should throw an error when attempting to approve a PUSHED_TO_CHANNELS recommendation', () => {
      const recommendation = new PriceMarkdownRecommendation(
        defaultId,
        defaultSku,
        defaultPriceCents,
        defaultReasoning,
        MarkdownStatus.PUSHED_TO_CHANNELS
      );

      expect(() => recommendation.approve()).toThrow('Can only approve PROPOSED markdowns');
    });
  });

  describe('pushToChannels', () => {
    it('should transition status from APPROVED to PUSHED_TO_CHANNELS', () => {
      const recommendation = new PriceMarkdownRecommendation(
        defaultId,
        defaultSku,
        defaultPriceCents,
        defaultReasoning,
        MarkdownStatus.APPROVED
      );

      recommendation.pushToChannels();

      expect(recommendation.status).toBe(MarkdownStatus.PUSHED_TO_CHANNELS);
    });

    it('should throw an error when attempting to push a PROPOSED recommendation', () => {
      const recommendation = new PriceMarkdownRecommendation(
        defaultId,
        defaultSku,
        defaultPriceCents,
        defaultReasoning,
        MarkdownStatus.PROPOSED
      );

      expect(() => recommendation.pushToChannels()).toThrow('Can only push APPROVED markdowns');
    });

    it('should throw an error when attempting to push an already PUSHED_TO_CHANNELS recommendation', () => {
      const recommendation = new PriceMarkdownRecommendation(
        defaultId,
        defaultSku,
        defaultPriceCents,
        defaultReasoning,
        MarkdownStatus.PUSHED_TO_CHANNELS
      );

      expect(() => recommendation.pushToChannels()).toThrow('Can only push APPROVED markdowns');
    });
  });

  describe('lifecycle workflow', () => {
    it('should successfully transition through PROPOSED -> APPROVED -> PUSHED_TO_CHANNELS', () => {
      const recommendation = new PriceMarkdownRecommendation(
        defaultId,
        defaultSku,
        defaultPriceCents,
        defaultReasoning
      );

      expect(recommendation.status).toBe(MarkdownStatus.PROPOSED);

      recommendation.approve();
      expect(recommendation.status).toBe(MarkdownStatus.APPROVED);

      recommendation.pushToChannels();
      expect(recommendation.status).toBe(MarkdownStatus.PUSHED_TO_CHANNELS);
    });
  });
});

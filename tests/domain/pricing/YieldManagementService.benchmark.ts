import { YieldManagementService, YieldManagementRepository } from '../../../src/domain/pricing/YieldManagementService';
import { LiquidationRule } from '../../../src/domain/pricing/LiquidationRule';
import { MarkdownEvent } from '../../../src/domain/pricing/MarkdownEvent';

async function runBenchmark() {
  const tenantId = 'tenant-test-123';
  const numLots = 1000;

  const lots = Array.from({ length: numLots }, (_, i) => ({
    variantId: `variant-${i}`,
    currentPriceCents: 10000,
  }));

  const rule = new LiquidationRule('rule-1', tenantId, 30, 20, true);

  let singlePriceUpdates = 0;
  let singleEventSaves = 0;
  let batchPriceUpdates = 0;
  let batchEventSaves = 0;

  const mockRepo: YieldManagementRepository = {
    getActiveRules: async () => [rule],
    getLotsExpiringWithin: async () => lots,
    updateVariantPrice: async () => {
      singlePriceUpdates++;
    },
    saveMarkdownEvent: async () => {
      singleEventSaves++;
    },
    updateVariantPrices: async () => {
      batchPriceUpdates++;
    },
    saveMarkdownEvents: async () => {
      batchEventSaves++;
    },
  };

  const service = new YieldManagementService(mockRepo);

  const start = performance.now();
  const events = await service.runYieldOptimization(tenantId);
  const end = performance.now();

  const totalQueries = singlePriceUpdates + singleEventSaves + batchPriceUpdates + batchEventSaves;
  console.log(`Lots processed: ${events.length}`);
  console.log(`Execution time: ${(end - start).toFixed(2)}ms`);
  console.log(`Total database calls: ${totalQueries} (singlePrice: ${singlePriceUpdates}, singleEvent: ${singleEventSaves}, batchPrice: ${batchPriceUpdates}, batchEvent: ${batchEventSaves})`);
}

runBenchmark().catch(console.error);

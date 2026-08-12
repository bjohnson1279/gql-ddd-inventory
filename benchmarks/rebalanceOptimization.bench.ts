import { PrismaClient } from '@prisma/client';
import { RebalanceOptimizationService } from '../src/domain/services/RebalanceOptimizationService';

async function run() {
  const warehouses = [];
  const rules = [];
  const locations = [];
  const inventoryItems = [];
  const forecasts = [];

  for (let i = 0; i < 50; i++) {
    warehouses.push({ id: `wh-${i}`, name: `Warehouse ${i}`, region: 'Default' });
    locations.push({ id: `loc-${i}`, warehouseId: `wh-${i}` });
    rules.push({
      id: `rule-${i}`,
      sourceLocationId: `loc-${i}`,
      leadTimeDays: 3,
    });
  }

  for (let i = 0; i < 50; i++) {
    for (let j = 0; j < 100; j++) {
      inventoryItems.push({ sku: `sku-${j}`, locationId: `loc-${i}`, quantity: 100, allocated: 10, inTransit: 0 });
      forecasts.push({ sku: `sku-${j}`, locationId: `loc-${i}`, forecastedQuantity: 1000 });
    }
  }

  const mockPrisma = {
    warehouseLocation: { findMany: async () => locations },
    inventoryItem: { findMany: async () => inventoryItems },
    demandForecast: { findMany: async () => forecasts },
    replenishmentRule: { findMany: async () => rules }
  } as unknown as PrismaClient;

  const service = new RebalanceOptimizationService(mockPrisma);
  const tenantId = 'perf-tenant';

  // Warmup
  console.log('Warming up...');
  for (let i = 0; i < 5; i++) {
    await service.getRebalanceMatrix(tenantId);
  }

  const ITERATIONS = 100;
  console.log(`Running benchmark with ${ITERATIONS} iterations...`);

  const start = process.hrtime.bigint();

  for (let i = 0; i < ITERATIONS; i++) {
    await service.getRebalanceMatrix(tenantId);
  }

  const end = process.hrtime.bigint();
  const totalMs = Number(end - start) / 1_000_000;
  const avgMs = totalMs / ITERATIONS;

  console.log(`Total time: ${totalMs.toFixed(2)}ms`);
  console.log(`Average time per call: ${avgMs.toFixed(2)}ms`);
}

run().catch(console.error);

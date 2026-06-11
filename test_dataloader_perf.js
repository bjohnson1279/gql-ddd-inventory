const DataLoader = require('dataloader');

// Simulate the data structure
const numKits = 1000;
const componentsPerKit = 10;
const kitIds = Array.from({ length: numKits }, (_, i) => `kit-${i}`);

// Generate dummy components for the query mock
const dummyComponents = [];
for (let i = 0; i < numKits; i++) {
  const kitId = `kit-${i}`;
  for (let j = 0; j < componentsPerKit; j++) {
    dummyComponents.push({
      kitId: kitId,
      variantId: `variant-${i}-${j}`,
      quantity: 1,
    });
  }
}

// 1. Original Slow DataLoader
const slowLoader = new DataLoader(async (ids) => {
  // Simulate DB fetch
  const components = dummyComponents.filter(c => ids.includes(c.kitId));

  return ids.map((id) =>
    components
      .filter((c) => c.kitId === id)
      .map((c) => ({
        variantId: c.variantId,
        quantity: c.quantity,
      }))
  );
});

// 2. Optimized DataLoader
const fastLoader = new DataLoader(async (ids) => {
  // Simulate DB fetch
  const components = dummyComponents.filter(c => ids.includes(c.kitId));

  const componentsByKit = new Map();
  for (const c of components) {
    if (!componentsByKit.has(c.kitId)) {
      componentsByKit.set(c.kitId, []);
    }
    componentsByKit.get(c.kitId).push({
      variantId: c.variantId,
      quantity: c.quantity,
    });
  }

  return ids.map((id) => componentsByKit.get(id) || []);
});

async function runBenchmark() {
  // Warm up
  for (let i = 0; i < 5; i++) {
    await slowLoader.loadMany(kitIds);
    await fastLoader.loadMany(kitIds);
    slowLoader.clearAll();
    fastLoader.clearAll();
  }

  const iterations = 50;

  const startSlow = performance.now();
  for (let i = 0; i < iterations; i++) {
    await slowLoader.loadMany(kitIds);
    slowLoader.clearAll();
  }
  const endSlow = performance.now();

  const startFast = performance.now();
  for (let i = 0; i < iterations; i++) {
    await fastLoader.loadMany(kitIds);
    fastLoader.clearAll();
  }
  const endFast = performance.now();

  console.log(`Slow Loader: ${(endSlow - startSlow).toFixed(2)} ms`);
  console.log(`Fast Loader: ${(endFast - startFast).toFixed(2)} ms`);
  console.log(`Improvement: ${((endSlow - startSlow) / (endFast - startFast)).toFixed(2)}x faster`);
}

runBenchmark().catch(console.error);

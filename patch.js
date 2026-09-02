const fs = require('fs');

// Patch ReplenishmentEvaluator
const fileEval = 'src/domain/services/ReplenishmentEvaluator.ts';
let codeEval = fs.readFileSync(fileEval, 'utf8');

const searchEval1 = `    // Pre-fetch related entities to avoid N+1 queries in the loop
    const openPos = await this.poRepo.findAllByTenant(tenantId);`;
const replaceEval1 = `    // Pre-fetch related entities to avoid N+1 queries in the loop
    const allPos = await this.poRepo.findAllByTenant(tenantId); // ⚡ Bolt: Renamed to allPos since it contains all POs (including Received)`;

codeEval = codeEval.replace(searchEval1, replaceEval1);

const searchEval2 = `          const forecastedRop = await this.forecaster.forecastReorderPoint(
            skuObj,
            locId,
            rule.leadTimeDays,
            rule.safetyStock,
            windowDays,
            tenantId
          );`;
const replaceEval2 = `          const forecastedRop = await this.forecaster.forecastReorderPoint(
            skuObj,
            locId,
            rule.leadTimeDays,
            rule.safetyStock,
            windowDays,
            tenantId,
            allPos // ⚡ Bolt: Pass pre-fetched allPos to prevent N+1 query in forecaster
          );`;

codeEval = codeEval.replace(searchEval2, replaceEval2);

const searchEval3 = `        // 3. Check for existing open/draft Purchase Orders
        const hasOpenPo = openPos.some((po) => {
          return (
            po.destinationLocationId.equals(locId) &&
            (po.status === PurchaseOrderStatus.Draft || po.status === PurchaseOrderStatus.Ordered) &&
            po.items.some((item) => item.variantId.value === variantIdStr)
          );
        });`;
const replaceEval3 = `        // 3. Check for existing open/draft Purchase Orders
        const hasOpenPo = allPos.some((po) => {
          return (
            po.destinationLocationId.equals(locId) &&
            (po.status === PurchaseOrderStatus.Draft || po.status === PurchaseOrderStatus.Ordered) &&
            po.items.some((item) => item.variantId.value === variantIdStr)
          );
        });`;

codeEval = codeEval.replace(searchEval3, replaceEval3);
fs.writeFileSync(fileEval, codeEval);


// Patch ReplenishmentForecaster
const fileForecaster = 'src/domain/services/ReplenishmentForecaster.ts';
let codeForecaster = fs.readFileSync(fileForecaster, 'utf8');

const searchForecaster1 = `  async forecastReorderPoint(
    sku: Sku,
    locationId: LocationId,
    leadTimeDays: number,
    safetyStock: number,
    windowDays: number = 30,
    tenantId?: TenantId
  ): Promise<number> {`;

const replaceForecaster1 = `  async forecastReorderPoint(
    sku: Sku,
    locationId: LocationId,
    leadTimeDays: number,
    safetyStock: number,
    windowDays: number = 30,
    tenantId?: TenantId,
    preFetchedPos?: PurchaseOrder[]
  ): Promise<number> {`;

codeForecaster = codeForecaster.replace(searchForecaster1, replaceForecaster1);

const searchForecaster2 = `          const allPos = await this.poRepo.findAllByTenant(tenantId);
          // Filter received POs containing this variant at this location
          let receivedPos = allPos.filter((po) =>
            po.status === PurchaseOrderStatus.Received &&
            getLocIdStr(po.destinationLocationId) === ruleLocIdStr &&
            po.items.some((item) => {
              const itemVarId = typeof item.variantId === 'string' ? item.variantId : (item.variantId && 'value' in item.variantId ? item.variantId.value : '');
              return itemVarId === ruleVarId;
            })
          );

          // Fallback: search across all locations for this tenant if none at destination location
          if (receivedPos.length === 0) {
            receivedPos = allPos.filter((po) =>
              po.status === PurchaseOrderStatus.Received &&
              po.items.some((item) => {
                const itemVarId = typeof item.variantId === 'string' ? item.variantId : (item.variantId && 'value' in item.variantId ? item.variantId.value : '');
                return itemVarId === ruleVarId;
              })
            );
          }`;

const replaceForecaster2 = `          // ⚡ Bolt: Use preFetchedPos to prevent N+1 query when evaluated in a loop
          const allPos = preFetchedPos || await this.poRepo.findAllByTenant(tenantId);

          let receivedPos = [];
          let fallbackReceivedPos = [];

          // ⚡ Bolt: Single pass iteration instead of multiple filters and some() to avoid O(N*M) lookups
          for (const po of allPos) {
            if (po.status !== PurchaseOrderStatus.Received) continue;

            let hasVariant = false;
            for (const item of po.items) {
              const itemVarId = typeof item.variantId === 'string' ? item.variantId : (item.variantId && 'value' in item.variantId ? item.variantId.value : '');
              if (itemVarId === ruleVarId) {
                hasVariant = true;
                break;
              }
            }

            if (hasVariant) {
              fallbackReceivedPos.push(po);
              if (getLocIdStr(po.destinationLocationId) === ruleLocIdStr) {
                receivedPos.push(po);
              }
            }
          }

          if (receivedPos.length === 0) {
            receivedPos = fallbackReceivedPos;
          }`;

codeForecaster = codeForecaster.replace(searchForecaster2, replaceForecaster2);

const importSearch = `import { ILedgerRepository } from '../repositories/ILedgerRepository';`;
const importReplace = `import { PurchaseOrder } from '../entities/PurchaseOrder';\nimport { ILedgerRepository } from '../repositories/ILedgerRepository';`;
codeForecaster = codeForecaster.replace(importSearch, importReplace);

fs.writeFileSync(fileForecaster, codeForecaster);


// Update bolt.md
const fileBolt = '.jules/bolt.md';
let codeBolt = fs.readFileSync(fileBolt, 'utf8');
codeBolt += `
## 2024-05-24 - Prevent N+1 queries in Replenishment Evaluation Loops
**Learning:** \`ReplenishmentEvaluator.evaluateRulesForTenant\` iterates over all active replenishment rules. If dynamic ROP is enabled, it calls \`forecaster.forecastReorderPoint()\`. Previously, this forecaster fetched all purchase orders for the tenant from the database inside every loop iteration, leading to an N+1 query problem and severe performance degradation when rules scaled up.
**Action:** When a service layer iterates over business rules or items, explicitly pass the batch pre-fetched related entities (e.g. \`allPos\`) down to the downstream services (e.g. \`forecastReorderPoint\`) to reuse the single initial database query. Note that variables named \`openPos\` might misleadingly refer to all POs.

## 2024-05-24 - Avoid O(N*M) with Array Filter/Some
**Learning:** Chaining \`Array.filter()\` with a nested \`Array.some()\` lookup inside loops creates expensive O(N*M) scanning bottlenecks, especially across large sets like all Purchase Orders and their Line Items.
**Action:** Refactor these complex chains into a single \`for...of\` loop with early \`continue/break\` conditions to significantly reduce execution time and avoid intermediate array allocations.
`;
fs.writeFileSync(fileBolt, codeBolt);

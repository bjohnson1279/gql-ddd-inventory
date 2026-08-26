import { DisassembleKitUseCase } from './src/application/useCases/ManageKits';
import { IKitRepository } from './src/domain/repositories/IKitRepository';
import { IProductRepository } from './src/domain/repositories/IProductRepository';
import { ILedgerRepository } from './src/domain/repositories/ILedgerRepository';
import { IInventoryCostLayerRepository } from './src/domain/repositories/IInventoryCostLayerRepository';
import { IJournalRepository } from './src/domain/repositories/IJournalRepository';

import { Kit } from './src/domain/entities/Kit';
import { KitId } from './src/domain/valueObjects/KitId';
import { Sku } from './src/domain/valueObjects/Sku';
import { ProductVariantId } from './src/domain/valueObjects/ProductVariantId';
import { Product } from './src/domain/entities/Product';
import { ProductId } from './src/domain/valueObjects/ProductId';
import { VariantAttribute } from './src/domain/valueObjects/VariantAttribute';
import { InventoryCostLayer, InventoryCostLayerId } from './src/domain/entities/InventoryCostLayer';

async function runBenchmark() {
  const kitRepo: any = { findBySku: async () => kit };
  const productRepo: any = { findBySku: async () => kitProduct };
  const ledgerRepo: any = {
    currentQuantity: async () => 1000,
    append: async () => { await new Promise(r => setTimeout(r, 1)); },
    appendBatch: async () => { await new Promise(r => setTimeout(r, 1)); }
  };
  const costLayers: any = {
    save: async () => { await new Promise(r => setTimeout(r, 1)); }, // simulate DB latency
    saveBatch: async () => { await new Promise(r => setTimeout(r, 1)); },
    getActiveLayers: async (varId: any) => {
      await new Promise(r => setTimeout(r, 2)); // simulate DB latency of 2ms
      if (varId.equals(kitVariant.id)) {
        return [new InventoryCostLayer(new InventoryCostLayerId('L-KIT'), kitVariant.id, 1000, 400, new Date())];
      }
      return [new InventoryCostLayer(new InventoryCostLayerId('L-COMP'), varId, 1000, 100, new Date())];
    },
    getActiveLayersBatch: async (varIds: any[]) => {
      await new Promise(r => setTimeout(r, 5)); // simulate DB batch query latency of 5ms
      const map = new Map();
      for (const varId of varIds) {
        if (varId.equals(kitVariant.id)) {
          map.set(varId.value, [new InventoryCostLayer(new InventoryCostLayerId('L-KIT'), kitVariant.id, 1000, 400, new Date())]);
        } else {
          map.set(varId.value, [new InventoryCostLayer(new InventoryCostLayerId('L-COMP'), varId, 1000, 100, new Date())]);
        }
      }
      return map;
    }
  };
  const journalRepo: any = { save: async () => { await new Promise(r => setTimeout(r, 1)); } };

  const kitSkuStr = 'KIT-COMBO';
  const kitVariantId = new ProductVariantId('V-KIT');
  const kit = new Kit(new KitId('K1'), new Sku(kitSkuStr), 'Combo Bundle');

  // Add 100 components to simulate a large kit and exacerbate N+1
  for (let i = 0; i < 100; i++) {
    kit.addComponent(new ProductVariantId(`V-COMP${i}`), 1);
  }

  const kitProduct = new Product(new ProductId('P-KIT'), 'Combo Bundle Product');
  const kitVariant = kitProduct.addVariant(new Sku(kitSkuStr), [new VariantAttribute('type', 'bundle')]);

  const useCase = new DisassembleKitUseCase(kitRepo, productRepo, ledgerRepo, costLayers, journalRepo);

  const start = Date.now();
  await useCase.execute({
    tenantId: 'T1',
    locationId: 'LOC1',
    kitSku: kitSkuStr,
    quantity: 1,
    actorId: 'A1',
    referenceId: 'REF1'
  });
  const end = Date.now();
  console.log(`DisassembleKitUseCase with 100 components took ${end - start} ms`);
}

runBenchmark().catch(console.error);

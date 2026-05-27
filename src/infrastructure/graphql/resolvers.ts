import { ReceiveStockUseCase } from '../../application/useCases/ReceiveStock';
import { DispatchStockUseCase } from '../../application/useCases/DispatchStock';
import { GetStockLevelsUseCase, GetStockLevelsBySkuUseCase, GetStockLevelBySkuAndLocationUseCase } from '../../application/useCases/GetStockLevels';
import { SubmitInventoryCountUseCase } from '../../application/useCases/SubmitInventoryCount';
import { SubmitOpeningBalanceUseCase } from '../../application/useCases/SubmitOpeningBalance';
import { InMemoryInventoryRepository } from '../persistence/InMemoryInventoryRepository';
import { InMemoryLedgerRepository } from '../persistence/InMemoryLedgerRepository';
import { OpeningBalanceService } from '../../domain/services/OpeningBalanceService';
import { DomainEventDispatcher } from '../../application/services/DomainEventDispatcher';

// We initialize our dependencies here (or you could use a DI container like TSyringe)
const inventoryRepository = new InMemoryInventoryRepository();
const ledgerRepository = new InMemoryLedgerRepository();

const openingBalanceService = new OpeningBalanceService(ledgerRepository);
const eventDispatcher = new DomainEventDispatcher();

const receiveStockUseCase = new ReceiveStockUseCase(inventoryRepository);
const dispatchStockUseCase = new DispatchStockUseCase(inventoryRepository, eventDispatcher);
const getStockLevelsUseCase = new GetStockLevelsUseCase(inventoryRepository);
const getStockLevelsBySkuUseCase = new GetStockLevelsBySkuUseCase(inventoryRepository);
const getStockLevelBySkuAndLocationUseCase = new GetStockLevelBySkuAndLocationUseCase(inventoryRepository);
const submitInventoryCountUseCase = new SubmitInventoryCountUseCase(inventoryRepository, eventDispatcher);
const submitOpeningBalanceUseCase = new SubmitOpeningBalanceUseCase(openingBalanceService);

export const resolvers = {
  Query: {
    inventoryItems: async () => {
      return await getStockLevelsUseCase.execute();
    },
    inventoryItemBySku: async (_: any, { sku }: { sku: string }) => {
      return await getStockLevelsBySkuUseCase.execute(sku);
    },
    inventoryItemBySkuAndLocation: async (_: any, { sku, locationId }: { sku: string, locationId: string }) => {
      return await getStockLevelBySkuAndLocationUseCase.execute(sku, locationId);
    },
  },
  Mutation: {
    receiveStock: async (_: any, { sku, locationId, amount }: { sku: string; locationId: string; amount: number }) => {
      try {
        return await receiveStockUseCase.execute(sku, locationId, amount);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    dispatchStock: async (_: any, { sku, locationId, amount }: { sku: string; locationId: string; amount: number }) => {
      try {
        return await dispatchStockUseCase.execute(sku, locationId, amount);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    submitInventoryCount: async (_: any, { counts }: { counts: { sku: string; locationId: string; actualQuantity: number }[] }) => {
      try {
        return await submitInventoryCountUseCase.execute(counts);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    submitOpeningBalance: async (_: any, { input }: { input: any }) => {
      try {
        return await submitOpeningBalanceUseCase.execute(input);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
  },
};

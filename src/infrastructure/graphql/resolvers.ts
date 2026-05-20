import { ReceiveStockUseCase } from '../../application/useCases/ReceiveStock';
import { DispatchStockUseCase } from '../../application/useCases/DispatchStock';
import { GetStockLevelsUseCase, GetStockLevelBySkuUseCase } from '../../application/useCases/GetStockLevels';
import { SubmitInventoryCountUseCase } from '../../application/useCases/SubmitInventoryCount';
import { SubmitOpeningBalanceUseCase } from '../../application/useCases/SubmitOpeningBalance';
import { InMemoryInventoryRepository } from '../persistence/InMemoryInventoryRepository';
import { InMemoryLedgerRepository } from '../persistence/InMemoryLedgerRepository';
import { OpeningBalanceService } from '../../domain/services/OpeningBalanceService';

// We initialize our dependencies here (or you could use a DI container like TSyringe)
const inventoryRepository = new InMemoryInventoryRepository();
const ledgerRepository = new InMemoryLedgerRepository();

const openingBalanceService = new OpeningBalanceService(ledgerRepository);

const receiveStockUseCase = new ReceiveStockUseCase(inventoryRepository);
const dispatchStockUseCase = new DispatchStockUseCase(inventoryRepository);
const getStockLevelsUseCase = new GetStockLevelsUseCase(inventoryRepository);
const getStockLevelBySkuUseCase = new GetStockLevelBySkuUseCase(inventoryRepository);
const submitInventoryCountUseCase = new SubmitInventoryCountUseCase(inventoryRepository);
const submitOpeningBalanceUseCase = new SubmitOpeningBalanceUseCase(openingBalanceService);

export const resolvers = {
  Query: {
    inventoryItems: async () => {
      return await getStockLevelsUseCase.execute();
    },
    inventoryItemBySku: async (_: any, { sku }: { sku: string }) => {
      return await getStockLevelBySkuUseCase.execute(sku);
    },
  },
  Mutation: {
    receiveStock: async (_: any, { sku, amount }: { sku: string; amount: number }) => {
      try {
        return await receiveStockUseCase.execute(sku, amount);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    dispatchStock: async (_: any, { sku, amount }: { sku: string; amount: number }) => {
      try {
        return await dispatchStockUseCase.execute(sku, amount);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    submitInventoryCount: async (_: any, { counts }: { counts: { sku: string; actualQuantity: number }[] }) => {
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

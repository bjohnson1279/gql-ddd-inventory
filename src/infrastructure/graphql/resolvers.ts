import { ReceiveStockUseCase } from '../../application/useCases/ReceiveStock';
import { DispatchStockUseCase } from '../../application/useCases/DispatchStock';
import { GetStockLevelsUseCase, GetStockLevelsBySkuUseCase, GetStockLevelBySkuAndLocationUseCase } from '../../application/useCases/GetStockLevels';
import { SubmitInventoryCountUseCase } from '../../application/useCases/SubmitInventoryCount';
import { SubmitOpeningBalanceUseCase } from '../../application/useCases/SubmitOpeningBalance';
import { PostgresInventoryRepository } from '../persistence/PostgresInventoryRepository';
import { PrismaClient } from '@prisma/client';
import { InMemoryLedgerRepository } from '../persistence/InMemoryLedgerRepository';
import { OpeningBalanceService } from '../../domain/services/OpeningBalanceService';
import { DomainEventDispatcher } from '../../application/services/DomainEventDispatcher';
import { InMemoryEventBus } from '../messaging/InMemoryEventBus';
import { LowStockAlertHandler } from '../../application/eventHandlers/LowStockAlertHandler';
import { InventoryReconciledHandler } from '../../application/eventHandlers/InventoryReconciledHandler';

import * as dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = `${process.env.DATABASE_URL}`;
export const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter } as any);
const inventoryRepository = new PostgresInventoryRepository(prisma);
const ledgerRepository = new InMemoryLedgerRepository();

const openingBalanceService = new OpeningBalanceService(ledgerRepository);

const eventBus = new InMemoryEventBus();
const lowStockHandler = new LowStockAlertHandler();
const reconciledHandler = new InventoryReconciledHandler();

eventBus.subscribe('LowStockAlertEvent', lowStockHandler.handle.bind(lowStockHandler));
eventBus.subscribe('InventoryReconciledEvent', reconciledHandler.handle.bind(reconciledHandler));

const eventDispatcher = new DomainEventDispatcher(eventBus);

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

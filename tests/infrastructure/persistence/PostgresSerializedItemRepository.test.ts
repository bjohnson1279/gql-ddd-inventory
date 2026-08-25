import { PostgresSerializedItemRepository } from '../../../src/infrastructure/persistence/PostgresSerializedItemRepository';
import { PrismaClient } from '@prisma/client';
import { SerializedItem } from '../../../src/domain/entities/SerializedItem';
import { SerializedItemId } from '../../../src/domain/valueObjects/SerializedItemId';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { SerialNumber } from '../../../src/domain/valueObjects/SerialNumber';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { SerializedItemStatus } from '../../../src/domain/enums/SerializedItemStatus';
import { StatusTransition } from '../../../src/domain/valueObjects/StatusTransition';
import { ActorId } from '../../../src/domain/valueObjects/ActorId';

const mockPrisma = {
  $transaction: jest.fn(),
  serializedItem: {
    upsert: jest.fn(),
    createMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn()
  },
  serializedItemHistory: {
    deleteMany: jest.fn(),
    createMany: jest.fn()
  },
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn()
};

describe('PostgresSerializedItemRepository', () => {
  let repo: PostgresSerializedItemRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PostgresSerializedItemRepository(mockPrisma as any);
  });

  describe('saveBatch', () => {
    it('should save a batch of items successfully', async () => {
      const tenantId = new TenantId('tenant-1');
      const locationId = new LocationId('loc-1');
      const variantId = new ProductVariantId('var-1');
      const actorId = new ActorId('user-1');

      const items = [
        new SerializedItem(
          new SerializedItemId('item-1'),
          variantId,
          new SerialNumber('SN-1'),
          tenantId,
          locationId,
          SerializedItemStatus.InStock
        ),
        new SerializedItem(
          new SerializedItemId('item-2'),
          variantId,
          new SerialNumber('SN-2'),
          tenantId,
          locationId,
          SerializedItemStatus.Transferred
        )
      ];

      items[0].transitionTo(SerializedItemStatus.Transferred, 'receipt', actorId);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });
      mockPrisma.$executeRaw.mockResolvedValue(2);

      await repo.saveBatch(items);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});

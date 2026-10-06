import { PostgresRmaRepository } from '../../../src/infrastructure/persistence/PostgresRmaRepository';
import { Rma } from '../../../src/domain/entities/Rma';
import { RmaItem } from '../../../src/domain/entities/RmaItem';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { RMAStatus, RMAItemStatus, RMADisposition } from '../../../src/domain/enums/ReturnEnums';

describe('PostgresRmaRepository', () => {
  let mockPrisma: any;
  let repo: PostgresRmaRepository;

  beforeEach(() => {
    mockPrisma = {
      rma: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      $executeRaw: jest.fn().mockResolvedValue(2),
      $transaction: jest.fn().mockImplementation(async (callback) => callback(mockPrisma)),
    };
    repo = new PostgresRmaRepository(mockPrisma);
  });

  it('should save RMA aggregate and batch upsert items without N+1 queries', async () => {
    const item1 = new RmaItem('item-1', new ProductVariantId('var-1'), 2, 1000, 1, RMAItemStatus.Pending, RMADisposition.Restock);
    const item2 = new RmaItem('item-2', new ProductVariantId('var-2'), 5, 2000, 0, RMAItemStatus.Pending, null);
    const rma = new Rma('rma-1', 'RMA-100', new TenantId('ten-1'), 'cust-1', new LocationId('loc-1'), RMAStatus.Requested, [item1, item2]);

    await repo.save(rma);

    expect(mockPrisma.rma.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});

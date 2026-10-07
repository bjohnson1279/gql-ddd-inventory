import { PostgresRmaRepository } from '../../../src/infrastructure/persistence/PostgresRmaRepository';
import { Rma } from '../../../src/domain/entities/Rma';
import { RmaItem } from '../../../src/domain/entities/RmaItem';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { RMAStatus, RMAItemStatus, RMADisposition } from '../../../src/domain/enums/ReturnEnums';

describe('PostgresRmaRepository', () => {
  let mockPrisma: any;
  let repository: PostgresRmaRepository;

  beforeEach(() => {
    mockPrisma = {
      rma: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      rmaItem: {
        createMany: jest.fn(),
      },
      $executeRaw: jest.fn(),
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };
    repository = new PostgresRmaRepository(mockPrisma);
  });

  it('should find RMA by ID', async () => {
    mockPrisma.rma.findUnique.mockResolvedValue({
      id: '123e4567-e89b-12d3-a456-426614174000',
      rmaNumber: 'RMA-001',
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      locationId: 'loc-1',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    });

    const result = await repository.findById('123e4567-e89b-12d3-a456-426614174000');
    expect(result).not.toBeNull();
    expect(result?.rmaNumber).toBe('RMA-001');
  });

  it('should find RMA by number', async () => {
    mockPrisma.rma.findUnique.mockResolvedValue({
      id: '123e4567-e89b-12d3-a456-426614174000',
      rmaNumber: 'RMA-001',
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      locationId: 'loc-1',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    });

    const result = await repository.findByNumber('RMA-001');
    expect(result).not.toBeNull();
    expect(result?.rmaNumber).toBe('RMA-001');
  });

  it('should find all RMAs by tenant', async () => {
    mockPrisma.rma.findMany.mockResolvedValue([
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        rmaNumber: 'RMA-001',
        tenantId: 'tenant-1',
        customerId: 'cust-1',
        locationId: 'loc-1',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      },
    ]);

    const results = await repository.findAllByTenant(new TenantId('tenant-1'));
    expect(results).toHaveLength(1);
    expect(results[0].rmaNumber).toBe('RMA-001');
  });

  it('should save RMA and batch upsert items without N+1 queries', async () => {
    const item1 = new RmaItem(
      '123e4567-e89b-12d3-a456-426614174001',
      new ProductVariantId('123e4567-e89b-12d3-a456-426614174002'),
      5,
      1000,
      2,
      RMAItemStatus.Received,
      RMADisposition.Restock
    );
    const item2 = new RmaItem(
      '123e4567-e89b-12d3-a456-426614174003',
      new ProductVariantId('123e4567-e89b-12d3-a456-426614174004'),
      3,
      2000,
      3,
      RMAItemStatus.Received,
      RMADisposition.Scrap
    );

    const rma = new Rma(
      '123e4567-e89b-12d3-a456-426614174000',
      'RMA-100',
      new TenantId('tenant-1'),
      'cust-1',
      new LocationId('loc-1'),
      RMAStatus.Authorized,
      [item1, item2],
      new Date(),
      new Date()
    );

    await repository.save(rma);

    expect(mockPrisma.rma.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.rmaItem.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ id: '123e4567-e89b-12d3-a456-426614174001', quantity: 5 }),
        expect.objectContaining({ id: '123e4567-e89b-12d3-a456-426614174003', quantity: 3 }),
      ]),
      skipDuplicates: true,
    });
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});

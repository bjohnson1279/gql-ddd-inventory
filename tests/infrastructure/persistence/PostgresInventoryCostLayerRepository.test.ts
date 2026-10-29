import { PostgresInventoryCostLayerRepository } from '../../../src/infrastructure/persistence/PostgresInventoryCostLayerRepository';
import { InventoryCostLayer, InventoryCostLayerId } from '../../../src/domain/entities/InventoryCostLayer';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { Lot } from '../../../src/domain/valueObjects/Lot';
import { SerialNumber } from '../../../src/domain/valueObjects/SerialNumber';

describe('PostgresInventoryCostLayerRepository', () => {
  let mockPrisma: any;
  let repo: PostgresInventoryCostLayerRepository;

  beforeEach(() => {
    mockPrisma = {
      inventoryCostLayer: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        fields: {
          initialQuantity: 'initialQuantity',
        },
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    repo = new PostgresInventoryCostLayerRepository(mockPrisma);
  });

  it('should early return when saveBatch is called with an empty array', async () => {
    await repo.saveBatch([]);
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('should execute raw batch upsert when saveBatch is called with layers', async () => {
    const layer1 = new InventoryCostLayer(
      new InventoryCostLayerId('00000000-0000-0000-0000-000000000001'),
      new ProductVariantId('00000000-0000-0000-0000-000000000002'),
      10,
      1000,
      new Date('2026-01-01T00:00:00Z'),
      new SerialNumber('SN-001'),
      new Lot('LOT-100', new Date('2027-01-01T00:00:00Z'))
    );

    const layer2 = new InventoryCostLayer(
      new InventoryCostLayerId('00000000-0000-0000-0000-000000000003'),
      new ProductVariantId('00000000-0000-0000-0000-000000000002'),
      5,
      1200,
      new Date('2026-02-01T00:00:00Z')
    );

    await repo.saveBatch([layer1, layer2]);

    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('should map active layers correctly in getActiveLayers', async () => {
    mockPrisma.inventoryCostLayer.findMany.mockResolvedValue([
      {
        id: 'layer-1',
        variantId: 'var-1',
        initialQuantity: 10,
        consumedQuantity: 3,
        unitCostCents: 500,
        receivedAt: new Date('2026-01-01'),
        serialNumber: 'SN-001',
        lotNumber: 'LOT-1',
        expirationDate: new Date('2027-01-01'),
      },
    ]);

    const layers = await repo.getActiveLayers(new ProductVariantId('var-1'), 'asc');
    expect(layers).toHaveLength(1);
    expect(layers[0].id.value).toBe('layer-1');
    expect(layers[0].consumedQuantity).toBe(3);
    expect(layers[0].lot?.lotNumber).toBe('LOT-1');
  });
});

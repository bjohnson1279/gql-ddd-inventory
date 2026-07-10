import { GetStockValuationReportUseCase } from '../../../src/application/useCases/GetStockValuationReport';
import { IInventoryRepository } from '../../../src/domain/repositories/IInventoryRepository';
import { IInventoryCostLayerRepository } from '../../../src/domain/repositories/IInventoryCostLayerRepository';
import { IProductRepository } from '../../../src/domain/repositories/IProductRepository';
import { InventoryItem } from '../../../src/domain/entities/InventoryItem';
import { Product } from '../../../src/domain/entities/Product';
import { ProductVariant } from '../../../src/domain/entities/ProductVariant';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { Quantity } from '../../../src/domain/valueObjects/Quantity';
import { ProductId } from '../../../src/domain/valueObjects/ProductId';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { CostingMethod } from '../../../src/domain/enums/AccountingEnums';
import { CostLayerService } from '../../../src/domain/services/CostLayerService';
import { VariantAttributeSet } from '../../../src/domain/valueObjects/VariantAttributeSet';
import { VariantAttribute } from '../../../src/domain/valueObjects/VariantAttribute';
import { CostBreakdown } from '../../../src/domain/valueObjects/CostBreakdown';

describe('GetStockValuationReportUseCase', () => {
  let mockInventoryRepo: jest.Mocked<IInventoryRepository>;
  let mockCostLayerRepo: jest.Mocked<IInventoryCostLayerRepository>;
  let mockProductRepo: jest.Mocked<IProductRepository>;
  let useCase: GetStockValuationReportUseCase;
  let calculateCostSpy: jest.SpyInstance;

  beforeEach(() => {
    mockInventoryRepo = {
      findById: jest.fn(),
      findBySku: jest.fn(),
      findBySkuAndLocation: jest.fn(),
      findBySkuAndLocationBatch: jest.fn(),
      findByLocation: jest.fn(),
      save: jest.fn(),
      saveBatch: jest.fn(),
      findAll: jest.fn(),
    };

    mockCostLayerRepo = {
      save: jest.fn(),
      saveBatch: jest.fn(),
      getActiveLayers: jest.fn(),
      getActiveLayersBatch: jest.fn(),
      findBySerial: jest.fn(),
    };

    mockProductRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      findBySku: jest.fn(),
      findBySkus: jest.fn(),
      findSkuByVariantId: jest.fn(),
      findSkusByVariantIds: jest.fn(),
      findAll: jest.fn(),
    };

    useCase = new GetStockValuationReportUseCase(
      mockInventoryRepo,
      mockCostLayerRepo,
      mockProductRepo
    );

    // We spy on calculateCost as this is what's called by the UseCase now
    calculateCostSpy = jest.spyOn(CostLayerService.prototype, 'calculateCost');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should calculate cost breakdown properly and accumulate total value', async () => {
    const invItem1 = new InventoryItem(
      'inv-1',
      new Sku('SKU1'),
      new LocationId('LOC1'),
      new Quantity(10)
    );
    const invItem2 = new InventoryItem(
      'inv-2',
      new Sku('SKU2'),
      new LocationId('LOC2'),
      new Quantity(5)
    );

    mockInventoryRepo.findAll.mockResolvedValue([invItem1, invItem2]);

    const variant1 = new ProductVariant(
      new ProductVariantId('var-1'),
      new ProductId('prod-1'),
      new Sku('SKU1'),
      new VariantAttributeSet([new VariantAttribute('Color', 'Red')])
    );
    const variant2 = new ProductVariant(
      new ProductVariantId('var-2'),
      new ProductId('prod-2'),
      new Sku('SKU2'),
      new VariantAttributeSet([new VariantAttribute('Color', 'Blue')])
    );

    const variants1 = new Map<string, ProductVariant>();
    variants1.set('var-1', variant1);
    const product1 = new Product(
      new ProductId('prod-1'),
      'Product 1',
      variants1
    );

    const variants2 = new Map<string, ProductVariant>();
    variants2.set('var-2', variant2);
    const product2 = new Product(
      new ProductId('prod-2'),
      'Product 2',
      variants2
    );

    mockProductRepo.findBySkus.mockResolvedValue([product1, product2]);

    // First call returns 1000 for 10 items
    // Second call returns 500 for 5 items
    calculateCostSpy.mockResolvedValueOnce(new CostBreakdown(10, 1000))
                    .mockResolvedValueOnce(new CostBreakdown(5, 500));

    const result = await useCase.execute('tenant-1', null, CostingMethod.FIFO);

    expect(result.totalValueCents).toBe(1500);
    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[0]).toEqual({
      sku: 'SKU1',
      variantId: 'var-1',
      locationId: 'LOC1',
      quantityOnHand: 10,
      unitCostCents: 100,
      totalValueCents: 1000,
      costingMethod: CostingMethod.FIFO,
    });
    expect(result.lineItems[1]).toEqual({
      sku: 'SKU2',
      variantId: 'var-2',
      locationId: 'LOC2',
      quantityOnHand: 5,
      unitCostCents: 100,
      totalValueCents: 500,
      costingMethod: CostingMethod.FIFO,
    });
  });

  it('should include 0 value line item when cost calculation throws exception', async () => {
    const invItem = new InventoryItem(
      'inv-1',
      new Sku('SKU1'),
      new LocationId('LOC1'),
      new Quantity(10)
    );

    mockInventoryRepo.findAll.mockResolvedValue([invItem]);

    const variant = new ProductVariant(
      new ProductVariantId('var-1'),
      new ProductId('prod-1'),
      new Sku('SKU1'),
      new VariantAttributeSet([new VariantAttribute('Color', 'Red')])
    );
    const variants = new Map<string, ProductVariant>();
    variants.set('var-1', variant);
    const product = new Product(
      new ProductId('prod-1'),
      'Product 1',
      variants
    );

    mockProductRepo.findBySkus.mockResolvedValue([product]);

    // Mock calculateCost to throw an error, correctly simulating missing layers exception
    calculateCostSpy.mockRejectedValue(new Error("Missing layers"));

    const result = await useCase.execute('tenant-1', null, CostingMethod.FIFO);

    expect(result.totalValueCents).toBe(0);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]).toEqual({
      sku: 'SKU1',
      variantId: 'var-1',
      locationId: 'LOC1',
      quantityOnHand: 10,
      unitCostCents: 0,
      totalValueCents: 0,
      costingMethod: CostingMethod.FIFO,
    });
  });

  it('should ignore inventory items with quantity <= 0', async () => {
    const invItem1 = new InventoryItem(
      'inv-1',
      new Sku('SKU1'),
      new LocationId('LOC1'),
      new Quantity(0)
    );

    mockInventoryRepo.findByLocation.mockResolvedValue([invItem1]);
    mockProductRepo.findBySkus.mockResolvedValue([]);

    const result = await useCase.execute('tenant-1', 'LOC1', CostingMethod.FIFO);

    expect(result.totalValueCents).toBe(0);
    expect(result.lineItems).toHaveLength(0);
  });

  it('should skip items without a valid variant ID', async () => {
    const invItem1 = new InventoryItem(
      'inv-1',
      new Sku('SKU1'),
      new LocationId('LOC1'),
      new Quantity(10)
    );

    mockInventoryRepo.findByLocation.mockResolvedValue([invItem1]);
    mockProductRepo.findBySkus.mockResolvedValue([]);

    const result = await useCase.execute('tenant-1', 'LOC1', CostingMethod.FIFO);

    expect(result.totalValueCents).toBe(0);
    expect(result.lineItems).toHaveLength(0);
  });
});

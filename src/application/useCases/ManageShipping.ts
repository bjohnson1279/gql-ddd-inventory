export interface ICarrierService {
  getRates(sku: string, qty: number, dest: string, origin?: string): Promise<any[]>;
  purchaseLabel(input: any): Promise<any>;
}

export interface IShipmentRepository {
  save(shipment: any): Promise<void>;
  findById(id: any): Promise<any>;
  findAll(): Promise<any[]>;
  update(input: any): Promise<void>;
}

export interface IInventoryRepository {
  // Placeholder for any methods needed by PurchaseShippingLabelUseCase
}

export interface IAccountingJournalService {
  // Placeholder for any methods needed by PurchaseShippingLabelUseCase
}

export interface IEventDispatcher {
  // Placeholder for any methods needed by PurchaseShippingLabelUseCase
}

export class CalculateShippingRatesUseCase {
  constructor(private carrierService: ICarrierService) {}

  execute = async (sku: string, qty: number, dest: string) => {
    return this.carrierService.getRates(sku, qty, dest);
  };
}

export class PurchaseShippingLabelUseCase {
  constructor(
    private shipmentRepository: IShipmentRepository,
    private carrierService: ICarrierService,
    private inventoryRepository: IInventoryRepository,
    private accountingJournalService: IAccountingJournalService,
    private eventDispatcher: IEventDispatcher
  ) {}

  execute = async (input: any) => {
    return this.carrierService.purchaseLabel(input);
  };
}

export class UpdateShipmentStatusUseCase {
  constructor(
    private shipmentRepository: IShipmentRepository,
    private eventDispatcher: IEventDispatcher
  ) {}

  execute = async (id: string, status: string) => {
    await this.shipmentRepository.update({ id, status });
    return true;
  };
}

export class GetShipmentsUseCase {
  constructor(private shipmentRepository: IShipmentRepository) {}

  execute = async () => {
    return this.shipmentRepository.findAll();
  };
}

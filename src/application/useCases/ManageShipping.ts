import crypto from 'crypto';
import { prisma } from '../../infrastructure/persistence/prismaClient';
import { IShipmentRepository } from '../../domain/repositories/IShipmentRepository';
import { ICarrierService, CarrierRate } from '../ports/ICarrierService';
import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { AccountingJournalService } from '../../domain/services/AccountingJournalService';
import { Shipment } from '../../domain/shipping/aggregates/Shipment';
import { ShipmentStatus } from '../../domain/shipping/enums/ShipmentStatus';
import { Quantity } from '../../domain/valueObjects/Quantity';
import { DomainEventDispatcher } from '../services/DomainEventDispatcher';
import { ShipmentCreatedEvent, ShipmentStatusUpdatedEvent } from '../../domain/events/ShippingEvents';

export interface CalculateShippingRatesQuery {
  sku: string;
  quantity: number;
  destinationAddress: string;
}

export class CalculateShippingRatesUseCase {
  constructor(private readonly carrierService: ICarrierService) {}

  async execute(query: CalculateShippingRatesQuery): Promise<CarrierRate[]> {
    const { sku, quantity, destinationAddress } = query;
    if (!sku || !destinationAddress) {
      throw new Error('Missing required rate fields: sku and destinationAddress.');
    }
    return this.carrierService.fetchRates(sku, quantity, destinationAddress);
  }
}

export interface PurchaseShippingLabelCommand {
  sku: string;
  quantity: number;
  destinationAddress: string;
  carrier: string;
  locationId: string;
  tenantId: string;
}

export interface PurchaseShippingLabelResult {
  shipmentId: string;
  trackingNumber: string;
  labelUrl: string;
  rateCents: number;
}

export class PurchaseShippingLabelUseCase {
  constructor(
    private readonly shipmentRepository: IShipmentRepository,
    private readonly carrierService: ICarrierService,
    private readonly inventoryRepository: IInventoryRepository,
    private readonly journalService: AccountingJournalService,
    private readonly eventDispatcher: DomainEventDispatcher
  ) {}

  async execute(command: PurchaseShippingLabelCommand): Promise<PurchaseShippingLabelResult> {
    const { sku, quantity, destinationAddress, carrier, locationId, tenantId } = command;

    if (!sku || !quantity || !destinationAddress || !carrier || !locationId || !tenantId) {
      throw new Error('Missing required parameters for shipping label purchase.');
    }

    // 1. Validate stock level
    const inventoryItem = await this.inventoryRepository.findBySkuAndLocation(sku, locationId);
    if (!inventoryItem) {
      throw new Error(`Inventory item not found for SKU ${sku} at location ${locationId}.`);
    }

    if (inventoryItem.quantity.value < quantity) {
      throw new Error(`Insufficient stock for SKU ${sku}. On-hand: ${inventoryItem.quantity.value}, Requested: ${quantity}`);
    }

    // 2. Generate carrier label
    const labelResult = await this.carrierService.generateLabel(sku, quantity, destinationAddress, carrier);

    // 3. Dispatch stock
    const quantityVO = new Quantity(quantity);
    inventoryItem.dispatchStock(quantityVO);
    await this.inventoryRepository.save(inventoryItem);
    this.eventDispatcher.dispatch(inventoryItem.pullDomainEvents());

    // 4. Create Shipment record
    const shipmentId = crypto.randomUUID();
    const shipment = new Shipment(
      shipmentId,
      sku,
      quantity,
      destinationAddress,
      carrier,
      labelResult.trackingNumber,
      labelResult.labelUrl,
      labelResult.rateCents,
      ShipmentStatus.LABEL_GENERATED,
      new Date(),
      new Date()
    );
    await this.shipmentRepository.save(shipment);

    // 5. Generate double-entry ledger listings
    await this.journalService.onShippingLabelPurchased(
      tenantId,
      shipmentId,
      labelResult.rateCents,
      carrier,
      labelResult.trackingNumber,
      new Date()
    );

    // 6. Write outbox event
    const event = new ShipmentCreatedEvent(
      shipmentId,
      sku,
      quantity,
      carrier,
      labelResult.trackingNumber,
      labelResult.rateCents
    );

    await prisma.outboxEvent.create({
      data: {
        eventType: 'ShipmentCreatedEvent',
        payload: JSON.stringify(event),
        status: 'Pending'
      }
    });

    this.eventDispatcher.dispatch([event]);

    return {
      shipmentId,
      trackingNumber: labelResult.trackingNumber,
      labelUrl: labelResult.labelUrl || '',
      rateCents: labelResult.rateCents
    };
  }
}

export interface UpdateShipmentStatusCommand {
  shipmentId: string;
  status: ShipmentStatus;
}

export class UpdateShipmentStatusUseCase {
  constructor(
    private readonly shipmentRepository: IShipmentRepository,
    private readonly eventDispatcher: DomainEventDispatcher
  ) {}

  async execute(command: UpdateShipmentStatusCommand): Promise<void> {
    const { shipmentId, status } = command;

    const shipment = await this.shipmentRepository.findById(shipmentId);
    if (!shipment) {
      throw new Error(`Shipment with ID ${shipmentId} not found.`);
    }

    const oldStatus = shipment.status;
    shipment.updateStatus(status);
    await this.shipmentRepository.save(shipment);

    // Write outbox event
    const event = new ShipmentStatusUpdatedEvent(
      shipmentId,
      shipment.trackingNumber,
      oldStatus,
      status
    );

    await prisma.outboxEvent.create({
      data: {
        eventType: 'ShipmentStatusUpdatedEvent',
        payload: JSON.stringify(event),
        status: 'Pending'
      }
    });

    this.eventDispatcher.dispatch([event]);
  }
}

export class GetShipmentsUseCase {
  constructor(private readonly shipmentRepository: IShipmentRepository) {}

  async execute(): Promise<Shipment[]> {
    return this.shipmentRepository.findAll();
  }
}

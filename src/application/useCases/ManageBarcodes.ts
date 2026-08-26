import { IBarcodeRepository } from '../../domain/repositories/IBarcodeRepository';
import { BarcodeRegistry } from '../../domain/services/BarcodeRegistry';
import { InternalBarcodeGenerator } from '../../domain/services/InternalBarcodeGenerator';
import { BarcodeScanDispatcher, ScanContext, IScanHandler } from '../../domain/services/BarcodeScanDispatcher';
import { Barcode } from '../../domain/valueObjects/Barcode';
import { BarcodeSymbology, BarcodeSource } from '../../domain/enums/BarcodeEnums';
import { Sku } from '../../domain/valueObjects/Sku';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { BarcodeAssignmentId } from '../../domain/valueObjects/BarcodeAssignmentId';
import { DispatchStockUseCase } from './DispatchStock';
import { ReceiveStockUseCase } from './ReceiveStock';
import { SubmitInventoryCountUseCase } from './SubmitInventoryCount';

export interface AssignBarcodeInput {
  sku: string;
  barcodeValue: string;
  symbology: BarcodeSymbology;
  source: BarcodeSource;
  makePrimary?: boolean;
}

export class AssignBarcodeUseCase {
  constructor(private readonly barcodeRepo: IBarcodeRepository) {}

  async execute(input: AssignBarcodeInput): Promise<boolean> {
    const sku = new Sku(input.sku);
    const set = await this.barcodeRepo.findSetBySku(sku);

    if (!set) {
      throw new Error(`ProductVariant not found for SKU: ${input.sku}`);
    }

    const barcode = new Barcode(input.symbology, input.barcodeValue);
    set.assign(barcode, input.source, input.makePrimary ?? false);

    await this.barcodeRepo.save(set);
    return true;
  }
}

export interface RevokeBarcodeInput {
  sku: string;
  assignmentId: string;
}

export class RevokeBarcodeUseCase {
  constructor(private readonly barcodeRepo: IBarcodeRepository) {}

  async execute(input: RevokeBarcodeInput): Promise<boolean> {
    const sku = new Sku(input.sku);
    const set = await this.barcodeRepo.findSetBySku(sku);

    if (!set) {
      throw new Error(`ProductVariant not found for SKU: ${input.sku}`);
    }

    set.revoke(new BarcodeAssignmentId(input.assignmentId));

    await this.barcodeRepo.save(set);
    return true;
  }
}

export class GenerateInternalBarcodeUseCase {
  constructor(
    private readonly barcodeRepo: IBarcodeRepository,
    private readonly generator: InternalBarcodeGenerator
  ) {}

  async execute(skuStr: string, tenantIdStr: string): Promise<string> {
    const sku = new Sku(skuStr);
    const set = await this.barcodeRepo.findSetBySku(sku);

    if (!set) {
      throw new Error(`ProductVariant not found for SKU: ${skuStr}`);
    }

    const generatedBarcode = await this.generator.generate(sku, new TenantId(tenantIdStr));
    set.assign(generatedBarcode, BarcodeSource.Internal, false);

    await this.barcodeRepo.save(set);
    return generatedBarcode.value;
  }
}

export class LookupBarcodeUseCase {
  constructor(private readonly registry: BarcodeRegistry) {}

  async execute(barcodeValue: string): Promise<string> {
    const sku = await this.registry.resolve(barcodeValue);
    return sku.value;
  }
}

export class DispatchBarcodeScanUseCase {
  constructor(private readonly dispatcher: BarcodeScanDispatcher) {}

  async execute(rawScan: string, context: ScanContext, payload: any): Promise<boolean> {
    await this.dispatcher.dispatch(rawScan, context, payload);
    return true;
  }
}

// --- Concrete Scan Handlers ---

export class POSScanHandler implements IScanHandler {
  constructor(private readonly dispatchStockUseCase: DispatchStockUseCase) {}

  async handle(sku: Sku, rawScan: string, payload: any): Promise<void> {
    if (!payload.locationId) {
      throw new Error('locationId is required for POS scan dispatch.');
    }
    await this.dispatchStockUseCase.execute(
      sku.value,
      payload.locationId,
      payload.amount ?? 1
    );
  }
}

export class ReceivingScanHandler implements IScanHandler {
  constructor(private readonly receiveStockUseCase: ReceiveStockUseCase) {}

  async handle(sku: Sku, rawScan: string, payload: any): Promise<void> {
    if (!payload.locationId) {
      throw new Error('locationId is required for Receiving scan dispatch.');
    }
    await this.receiveStockUseCase.execute(
      sku.value,
      payload.locationId,
      payload.amount ?? 1
    );
  }
}

export class CycleCountScanHandler implements IScanHandler {
  constructor(private readonly submitInventoryCountUseCase: SubmitInventoryCountUseCase) {}

  async handle(sku: Sku, rawScan: string, payload: any): Promise<void> {
    if (!payload.locationId) {
      throw new Error('locationId is required for CycleCount scan dispatch.');
    }
    if (payload.actualQuantity === undefined) {
      throw new Error('actualQuantity is required for CycleCount scan dispatch.');
    }
    await this.submitInventoryCountUseCase.execute([
      {
        sku: sku.value,
        locationId: payload.locationId,
        actualQuantity: payload.actualQuantity,
      },
    ]);
  }
}

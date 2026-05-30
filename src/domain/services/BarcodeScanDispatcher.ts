import { BarcodeRegistry } from './BarcodeRegistry';
import { Sku } from '../valueObjects/Sku';

export enum ScanContext {
  PointOfSale = 'pos',
  Receiving = 'receiving',
  CycleCount = 'cycle_count',
  TransferOut = 'transfer_out',
  TransferIn = 'transfer_in',
}

export interface IScanHandler {
  handle(sku: Sku, rawScan: string, payload: any): Promise<void>;
}

export class BarcodeScanDispatcher {
  private readonly handlers = new Map<ScanContext, IScanHandler>();

  constructor(private readonly registry: BarcodeRegistry) {}

  register(context: ScanContext, handler: IScanHandler): void {
    this.handlers.set(context, handler);
  }

  async dispatch(rawScan: string, context: ScanContext, payload: any = {}): Promise<void> {
    const sku = await this.registry.resolve(rawScan);
    const handler = this.handlers.get(context);

    if (!handler) {
      throw new Error(`No handler registered for scan context: ${context}`);
    }

    await handler.handle(sku, rawScan, payload);
  }
}

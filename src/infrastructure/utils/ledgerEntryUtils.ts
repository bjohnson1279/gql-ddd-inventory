import crypto from 'crypto';
import { ILedgerRepository } from '../../domain/repositories/ILedgerRepository';
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { LedgerEntry } from '../../domain/entities/LedgerEntry';
import { LedgerEntryId } from '../../domain/valueObjects/LedgerEntryId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { ActorId } from '../../domain/valueObjects/ActorId';
import { ReasonCode } from '../../domain/enums/ReasonCode';
import { Sku } from '../../domain/valueObjects/Sku';

export interface LedgerMutationContext {
  auth?: {
    tenantId?: string;
    actorId?: string;
  };
}

export async function appendStockLedgerEntry(
  productRepository: IProductRepository,
  ledgerRepository: ILedgerRepository,
  sku: string,
  locationId: string,
  quantity: number,
  reason: ReasonCode,
  context: LedgerMutationContext
): Promise<void> {
  const product = await productRepository.findBySku(new Sku(sku));
  const variant = product?.findVariantBySku(sku);
  if (!variant) return;

  const tenantId = new TenantId(context?.auth?.tenantId || 'default');
  const actor = new ActorId(context?.auth?.actorId || 'system');

  const ledgerEntry = new LedgerEntry(
    new LedgerEntryId(crypto.randomUUID()),
    tenantId,
    new LocationId(locationId),
    variant.id,
    quantity,
    reason,
    actor,
    new Date()
  );

  await ledgerRepository.append(ledgerEntry);
}

export async function appendStockLedgerEntries(
  productRepository: IProductRepository,
  ledgerRepository: ILedgerRepository,
  entriesData: { sku: string; locationId: string; quantity: number }[],
  reason: ReasonCode,
  context: LedgerMutationContext
): Promise<void> {
  if (entriesData.length === 0) return;

  const skus = Array.from(new Set(entriesData.map(e => e.sku))).map(s => new Sku(s));
  const products = await productRepository.findBySkus(skus);

  const variantIdMap = new Map<string, string>(); // sku string -> variant id string
  for (const product of products) {
    for (const variant of product.variants) {
      variantIdMap.set(variant.sku.value, variant.id.value);
    }
  }

  const tenantId = new TenantId(context?.auth?.tenantId || 'default');
  const actor = new ActorId(context?.auth?.actorId || 'system');
  const now = new Date();

  const ledgerEntries: LedgerEntry[] = [];

  for (const data of entriesData) {
    const variantIdStr = variantIdMap.get(data.sku);
    if (!variantIdStr) continue;

    const entry = new LedgerEntry(
      new LedgerEntryId(crypto.randomUUID()),
      tenantId,
      new LocationId(data.locationId),
      new ProductVariantId(variantIdStr),
      data.quantity,
      reason,
      actor,
      now
    );
    ledgerEntries.push(entry);
  }

  if (ledgerEntries.length > 0) {
    await ledgerRepository.appendBatch(ledgerEntries);
  }
}

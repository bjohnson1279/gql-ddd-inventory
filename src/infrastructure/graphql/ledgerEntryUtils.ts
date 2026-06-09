import crypto from 'crypto';
import { ILedgerRepository } from '../../domain/repositories/ILedgerRepository';
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { LedgerEntry } from '../../domain/entities/LedgerEntry';
import { LedgerEntryId } from '../../domain/valueObjects/LedgerEntryId';
import { LocationId } from '../../domain/valueObjects/LocationId';
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
  const variant = product?.variants.find(v => v.sku.value === sku);
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

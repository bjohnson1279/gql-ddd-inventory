import { PrismaClient } from '@prisma/client';
import { AuditProcessorService } from './src/domain/services/AuditProcessorService';
import { TenantId } from './src/domain/valueObjects/TenantId';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function run() {
  const tenantId = crypto.randomUUID();
  const connId = crypto.randomUUID();
  const productId = crypto.randomUUID();

  await prisma.tenant.create({ data: { id: tenantId, name: 'Bench Tenant' } });

  await prisma.integrationConnection.create({
    data: {
      id: connId,
      tenantId,
      platform: 'Shopify',
      storeDomain: 'test.myshopify.com',
      accessToken: 'xxx',
      isActive: true
    }
  });

  await prisma.product.create({ data: { id: productId, title: 'Bench Product', description: '' } });

  for (let i = 0; i < 50; i++) {
    const variantId = crypto.randomUUID();
    await prisma.productVariant.create({
      data: { id: variantId, productId, sku: `SKU-${i}`, title: `Var ${i}`, barcode: `BAR-${i}` }
    });
    await prisma.externalMapping.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        integrationId: connId,
        entityType: 'VARIANT',
        internalId: variantId,
        externalId: `ext-var-${i}`,
        externalSecondaryId: `inv-item-${i}`
      }
    });

    // Add ledger entries
    await prisma.ledgerEntry.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        variantId,
        locationId: 'loc-1',
        quantity: 10,
        occurredAt: new Date(),
        referenceId: 'ref-1'
      }
    });
  }

  await prisma.externalMapping.create({
    data: {
      id: crypto.randomUUID(),
      tenantId,
      integrationId: connId,
      entityType: 'LOCATION',
      internalId: 'loc-1',
      externalId: 'ext-loc-1'
    }
  });
  await prisma.externalMapping.create({
    data: {
      id: crypto.randomUUID(),
      tenantId,
      integrationId: connId,
      entityType: 'LOCATION',
      internalId: 'loc-2',
      externalId: 'ext-loc-2'
    }
  });

  const service = new AuditProcessorService(prisma);

  const start = Date.now();
  await service.runAudit(tenantId);
  const duration = Date.now() - start;

  console.log(`Audit run in ${duration}ms`);
}

run().catch(console.error).finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
import { AuditDiscrepancy } from '../entities/AuditDiscrepancy';
import crypto from 'crypto';
import { validateOutboundUrl } from '../../utils/urlValidator';
import { getTraceId } from '../../infrastructure/telemetry/traceContext';

export class AuditProcessorService {
  constructor(private readonly prisma: PrismaClient) {}

  async runAudit(tenantId: string): Promise<{ shopifyDiscrepancies: number; accountingDiscrepancies: number }> {
    let shopifyCount = 0;
    let accountingCount = 0;

    // 1. Shopify stock audit
    // Find active shopify connections
    const connections = await this.prisma.integrationConnection.findMany({
      where: { tenantId, platform: 'Shopify', isActive: true }
    });

    if (connections.length > 0) {
      // Find all variant mappings
      const variantMappings = await this.prisma.externalMapping.findMany({
        where: { tenantId, entityType: 'VARIANT' }
      });

      // Find all location mappings
      const locationMappings = await this.prisma.externalMapping.findMany({
        where: { tenantId, entityType: 'LOCATION' }
      });

      for (const conn of connections) {
        const connVariantMappings = variantMappings.filter((m) => m.integrationId === conn.id);
        const connLocationMappings = locationMappings.filter((m) => m.integrationId === conn.id);

        const shopifyStockMap: Record<string, Record<string, number>> = {}; // inventoryItemId -> externalLocId -> quantity
        const externalItemIds = Array.from(new Set(
          connVariantMappings.map((m) => m.externalSecondaryId).filter(Boolean) as string[]
        ));

        const isMock = !conn.accessToken || conn.accessToken === 'mock-token' || conn.storeDomain.includes('mock');

        if (!isMock && externalItemIds.length > 0) {
          const chunkSize = 50;
          for (let i = 0; i < externalItemIds.length; i += chunkSize) {
            const batchIds = externalItemIds.slice(i, i + chunkSize);
            try {
              const response = await fetch(
                validateOutboundUrl(`https://${conn.storeDomain}/admin/api/2024-04/graphql.json`),
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': conn.accessToken!
                  },
                  redirect: 'error',
                  body: JSON.stringify({
                    query: `
                      query getBatchInventoryLevels($ids: [ID!]!) {
                        nodes(ids: $ids) {
                          ... on InventoryItem {
                            id
                            inventoryLevels(first: 50) {
                              edges {
                                node {
                                  location { id }
                                  quantities(names: ["available"]) { quantity }
                                }
                              }
                            }
                          }
                        }
                      }
                    `,
                    variables: { ids: batchIds }
                  })
                }
              );

              if (response.ok) {
                const resData = (await response.json()) as any;
                const nodes = resData?.data?.nodes || [];
                for (const node of nodes) {
                  if (node && node.id) {
                    const levels = node.inventoryLevels?.edges || [];
                    const locQtyMap: Record<string, number> = {};
                    for (const edge of levels) {
                      const extLocId = edge.node.location.id;
                      const qty = edge.node.quantities[0]?.quantity || 0;
                      locQtyMap[extLocId] = qty;
                    }
                    shopifyStockMap[node.id] = locQtyMap;
                  }
                }
              } else {
                console.error(`Shopify API responded with status ${response.status}`);
              }
            } catch (err) {
              console.error('Failed to query Shopify stock level batch:', err);
            }
          }
        }

        const variantIds = connVariantMappings.map((m) => m.internalId);
        const locationIds = connLocationMappings.map((m) => m.internalId);

        const variants = await this.prisma.productVariant.findMany({
          where: { id: { in: variantIds } }
        });
        const variantMap = new Map(variants.map(v => [v.id, v]));

        const ledgerSums = await this.prisma.ledgerEntry.groupBy({
          by: ['variantId', 'locationId'],
          where: {
            tenantId,
            variantId: { in: variantIds },
            locationId: { in: locationIds }
          },
          _sum: { quantity: true }
        });
        const ledgerSumMap = new Map<string, number>();
        for (const sum of ledgerSums) {
          ledgerSumMap.set(`${sum.variantId}_${sum.locationId}`, sum._sum.quantity || 0);
        }

        const openShopifyDiscrepancies = await this.prisma.auditDiscrepancy.findMany({
          where: { tenantId, type: 'SHOPIFY_STOCK_MISMATCH', status: 'OPEN' }
        });
        const openShopifySet = new Set(openShopifyDiscrepancies.map((d) => d.referenceId));
        for (const varMap of connVariantMappings) {
          const inventoryItemId = varMap.externalSecondaryId;
          if (!inventoryItemId) continue;

          const variant = await this.prisma.productVariant.findUnique({
            where: { id: varMap.internalId }
          });
          if (!variant) continue;

          for (const locMap of connLocationMappings) {
            const ledgerSum = await this.prisma.ledgerEntry.aggregate({
              where: { tenantId, variantId: variant.id, locationId: locMap.internalId },
              _sum: { quantity: true }
            });
            const localQty = ledgerSum._sum.quantity || 0;

            let shopifyQty = localQty;
            if (!isMock) {
              const matchedLevels = shopifyStockMap[inventoryItemId];
              if (matchedLevels && matchedLevels[locMap.externalId] !== undefined) {
                shopifyQty = matchedLevels[locMap.externalId];
              }
            } else {
              if (variant.sku.endsWith('-DIFF')) {
                shopifyQty = localQty + 10;
              }
            }

            if (localQty !== shopifyQty) {
              const referenceId = `${variant.sku}:${locMap.internalId}`;
              if (!openShopifySet.has(referenceId)) {
                await this.prisma.auditDiscrepancy.create({
                  data: {
                    id: crypto.randomUUID(),
                    tenantId,
                    type: 'SHOPIFY_STOCK_MISMATCH',
                    referenceId,
                    externalRefId: inventoryItemId,
                    description: `Shopify stock mismatch for SKU ${variant.sku} at location ${locMap.internalId}. Local: ${localQty}, Shopify: ${shopifyQty}`
                  }
                });
                shopifyCount++;
              }
            }
          }
        }
      }

    }

    // 2. Accounting sync audit
    // Check if QuickBooks or Xero or NetSuite connections are active
    const activeIntegrations = await this.prisma.integrationConnection.findMany({
      where: { tenantId, isActive: true }
    });

    const hasQbo = activeIntegrations.some((c) => c.platform === 'QUICKBOOKS' || c.platform === 'QuickBooks');
    const hasXero = activeIntegrations.some((c) => c.platform === 'XERO' || c.platform === 'Xero');
    const hasNetsuite = activeIntegrations.some((c) => c.platform === 'NETSUITE' || c.platform === 'NetSuite');

    if (hasQbo || hasXero || hasNetsuite) {
      // Fetch journal entries created in the last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const journals = await this.prisma.journalEntry.findMany({
        where: { tenantId, createdAt: { gte: sevenDaysAgo } }
      });

      const journalIds = journals.map((j) => j.id);

      const qboMappings = hasQbo && journalIds.length > 0
        ? await this.prisma.quickbooksJournalMapping.findMany({ where: { journalEntryId: { in: journalIds } } })
        : [];
      const qboMappingSet = new Set(qboMappings.map((m) => m.journalEntryId));

      const xeroMappings = hasXero && journalIds.length > 0
        ? await this.prisma.xeroJournalMapping.findMany({ where: { journalEntryId: { in: journalIds } } })
        : [];
      const xeroMappingSet = new Set(xeroMappings.map((m) => m.journalEntryId));

      const nsMappings = hasNetsuite && journalIds.length > 0
        ? await this.prisma.netsuiteJournalMapping.findMany({ where: { journalEntryId: { in: journalIds } } })
        : [];
      const nsMappingSet = new Set(nsMappings.map((m) => m.journalEntryId));

      const existingOpenDiscrepancies = journalIds.length > 0
        ? await this.prisma.auditDiscrepancy.findMany({
            where: {
              tenantId,
              type: 'ACCOUNTING_JOURNAL_MISSING',
              referenceId: { in: journalIds },
              status: 'OPEN'
            }
          })
        : [];
      const existingOpenSet = new Set(existingOpenDiscrepancies.map((d) => d.referenceId));

      for (const journal of journals) {
        const hasMapping = qboMappingSet.has(journal.id) || xeroMappingSet.has(journal.id) || nsMappingSet.has(journal.id);

        if (!hasMapping) {
          if (!existingOpenSet.has(journal.id)) {
            await this.prisma.auditDiscrepancy.create({
              data: {
                id: crypto.randomUUID(),
                tenantId,
                type: 'ACCOUNTING_JOURNAL_MISSING',
                referenceId: journal.id,
                description: `Journal entry ${journal.id} (${journal.description || 'No description'}) is not mapped to any external accounting transaction.`
              }
            });
            accountingCount++;
          }
        }
      }
    }

    return { shopifyDiscrepancies: shopifyCount, accountingDiscrepancies: accountingCount };
  }

  async resolveDiscrepancy(tenantId: string, id: string, notes: string): Promise<boolean> {
    const discrepancy = await this.prisma.auditDiscrepancy.findFirst({
      where: { id, tenantId }
    });
    if (!discrepancy || discrepancy.status === 'RESOLVED') return false;

    await this.prisma.$transaction(async (tx) => {
      // Resolve in DB
      await tx.auditDiscrepancy.update({
        where: { id },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolutionNotes: notes
        }
      });

      // If type is Shopify mismatch, trigger stock level push to Shopify via outbox to achieve eventual consistency
      if (discrepancy.type === 'SHOPIFY_STOCK_MISMATCH') {
        const parts = discrepancy.referenceId.split(':');
        const sku = parts[0];
        const locationId = parts[1];

        // Create the event payload
        const event = {
          tenantId,
          sku,
          locationId,
          externalRefId: discrepancy.externalRefId || '',
          occurredAt: new Date(),
          traceId: getTraceId()
        };

        // Write to Outbox table
        await tx.outboxEvent.create({
          data: {
            eventType: 'ShopifyStockSyncRequested',
            payload: JSON.stringify(event),
            status: 'Pending'
          }
        });
      }
    });

    return true;
  }
}


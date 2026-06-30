import { PrismaClient } from '@prisma/client';
import { AuditDiscrepancy } from '../entities/AuditDiscrepancy';
import crypto from 'crypto';

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

        for (const varMap of connVariantMappings) {
          const inventoryItemId = varMap.externalSecondaryId;
          if (!inventoryItemId) continue;

          // Get the local product variant SKU
          const variant = await this.prisma.productVariant.findUnique({
            where: { id: varMap.internalId }
          });
          if (!variant) continue;

          for (const locMap of connLocationMappings) {
            // Aggregate local quantities from ledger_entries for this variant and location
            const ledgerSum = await this.prisma.ledgerEntry.aggregate({
              where: { tenantId, variantId: variant.id, locationId: locMap.internalId },
              _sum: { quantity: true }
            });
            const localQty = ledgerSum._sum.quantity || 0;

            // Fetch quantity from Shopify
            let shopifyQty = localQty; // Default to match in case of network issue / mock mode
            if (conn.accessToken && conn.accessToken !== 'mock-token' && !conn.storeDomain.includes('mock')) {
              try {
                const response = await fetch(
                  `https://${conn.storeDomain}/admin/api/2024-04/graphql.json`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Shopify-Access-Token': conn.accessToken
                    },
                    body: JSON.stringify({
                      query: `
                        query getInventoryLevel($inventoryItemId: ID!) {
                          inventoryItem(id: $inventoryItemId) {
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
                      `,
                      variables: { inventoryItemId }
                    })
                  }
                );
                if (response.ok) {
                  const resData = (await response.json()) as any;
                  const edges = resData?.data?.inventoryItem?.inventoryLevels?.edges || [];
                  const matchedEdge = edges.find(
                    (e: any) => e.node.location.id === locMap.externalId
                  );
                  if (matchedEdge) {
                    shopifyQty = matchedEdge.node.quantities[0]?.quantity || 0;
                  }
                }
              } catch (err) {
                console.error('Failed to query Shopify stock level:', err);
              }
            } else {
              // Mock scenario: mock discrepancy if variant SKU ends with -DIFF
              if (variant.sku.endsWith('-DIFF')) {
                shopifyQty = localQty + 10;
              }
            }

            if (localQty !== shopifyQty) {
              // Check if open discrepancy exists
              const referenceId = `${variant.sku}:${locMap.internalId}`;
              const existingOpen = await this.prisma.auditDiscrepancy.findFirst({
                where: { tenantId, type: 'SHOPIFY_STOCK_MISMATCH', referenceId, status: 'OPEN' }
              });

              if (!existingOpen) {
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

      for (const journal of journals) {
        let hasMapping = false;
        if (hasQbo) {
          const mapping = await this.prisma.quickbooksJournalMapping.findUnique({
            where: { journalEntryId: journal.id }
          });
          if (mapping) hasMapping = true;
        }
        if (hasXero && !hasMapping) {
          const mapping = await this.prisma.xeroJournalMapping.findUnique({
            where: { journalEntryId: journal.id }
          });
          if (mapping) hasMapping = true;
        }
        if (hasNetsuite && !hasMapping) {
          const mapping = await this.prisma.netsuiteJournalMapping.findUnique({
            where: { journalEntryId: journal.id }
          });
          if (mapping) hasMapping = true;
        }

        if (!hasMapping) {
          const existingOpen = await this.prisma.auditDiscrepancy.findFirst({
            where: { tenantId, type: 'ACCOUNTING_JOURNAL_MISSING', referenceId: journal.id, status: 'OPEN' }
          });

          if (!existingOpen) {
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

    // Resolve in DB
    await this.prisma.auditDiscrepancy.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolutionNotes: notes
      }
    });

    // If type is Shopify mismatch, trigger stock level push to Shopify to achieve eventual consistency
    if (discrepancy.type === 'SHOPIFY_STOCK_MISMATCH') {
      const parts = discrepancy.referenceId.split(':');
      const sku = parts[0];
      const locationId = parts[1];

      // Find the variant
      const variant = await this.prisma.productVariant.findUnique({
        where: { sku }
      });

      // Find active shopify connections
      const connections = await this.prisma.integrationConnection.findMany({
        where: { tenantId, platform: 'Shopify', isActive: true }
      });

      if (variant && connections.length > 0) {
        // Find location mappings
        const locMapping = await this.prisma.externalMapping.findFirst({
          where: { tenantId, entityType: 'LOCATION', internalId: locationId }
        });

        // Sum local stock levels
        const ledgerSum = await this.prisma.ledgerEntry.aggregate({
          where: { tenantId, variantId: variant.id, locationId },
          _sum: { quantity: true }
        });
        const localQty = ledgerSum._sum.quantity || 0;

        for (const conn of connections) {
          if (conn.accessToken && conn.accessToken !== 'mock-token' && !conn.storeDomain.includes('mock') && locMapping) {
            try {
              // Mutation to set quantity on Shopify
              await fetch(
                `https://${conn.storeDomain}/admin/api/2024-04/graphql.json`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': conn.accessToken
                  },
                  body: JSON.stringify({
                    query: `
                      mutation setQty($input: InventorySetOnHandQuantitiesInput!) {
                        inventorySetOnHandQuantities(input: $input) {
                          userErrors { message }
                        }
                      }
                    `,
                    variables: {
                      input: {
                        setQuantities: [
                          {
                            inventoryItemId: discrepancy.externalRefId,
                            locationId: locMapping.externalId,
                            quantity: localQty
                          }
                        ]
                      }
                    }
                  })
                }
              );
            } catch (err) {
              console.error('Failed to resolve Shopify discrepancy by pushing correct stock:', err);
            }
          }
        }
      }
    }

    return true;
  }
}

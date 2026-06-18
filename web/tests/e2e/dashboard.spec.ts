import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Mock all backend Apollo GraphQL routes to keep E2E tests completely hermetic and fast
  await page.route('**/graphql', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      return route.fulfill({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
    if (request.method() !== 'POST') {
      return route.fallback();
    }

    const requestBody = request.postDataJSON();
    const query = requestBody?.query || '';
    const variables = requestBody?.variables || {};

    // 1. Onboarding Queries
    if (query.includes('query GetOnboardings') || query.includes('stockOnboardings(')) {
      return route.fulfill({
        contentType: 'application/json',
        json: {
          data: {
            stockOnboardings: [
              {
                id: 'ob-123',
                tenantId: variables.tenantId || 'tenant-1',
                locationId: 'loc-1',
                status: 'draft',
                asOfDate: '2026-05-29',
                items: [{ variantId: 'var-1', quantity: 10, unitCostCents: 500 }],
              },
            ],
          },
        },
      });
    } 
    
    // 2. Accounting/GL Entries Queries
    if (query.includes('query GetGL') || query.includes('journalEntries(')) {
      return route.fulfill({
        contentType: 'application/json',
        json: {
          data: {
            journalEntries: [
              {
                id: 'j-1',
                tenantId: 'tenant-1',
                date: '2026-05-29',
                description: 'Initial Opening Balance General Ledger Ingestion',
                method: 'accrual',
                referenceId: 'ref-1',
                lines: [
                  { accountCode: '1000', amountCents: 150000, type: 'debit', memo: 'Cash debit' },
                  { accountCode: '2000', amountCents: 150000, type: 'credit', memo: 'Equity credit' },
                ],
              },
            ],
          },
        },
      });
    } 
    
    // 3. Shopify Integration Queries
    if (query.includes('query GetShopify') || query.includes('shopifyConnections(')) {
      return route.fulfill({
        contentType: 'application/json',
        json: {
          data: {
            shopifyConnections: [
              {
                id: 'conn-1',
                tenantId: 'tenant-1',
                platform: 'shopify',
                storeDomain: 'cool-gear-test.myshopify.com',
                isActive: true,
              },
            ],
          },
        },
      });
    } 
    
    // 4. Barcodes Queries
    if (query.includes('query GetBarcodes') || query.includes('barcodeSet(')) {
      return route.fulfill({
        contentType: 'application/json',
        json: {
          data: {
            barcodeSet: {
              assignments: [
                {
                  id: 'bc-1',
                  sku: variables.sku || 'SKU-A',
                  barcode: { value: '123456789012', symbology: 'upc_a' },
                  source: 'supplier',
                  isPrimary: true,
                  assignedAt: '2026-05-29T22:00:00Z',
                },
              ],
            },
          },
        },
      });
    } 
    
    // 5. Main Dashboard Queries (Products List)
    if (query.includes('products')) {
      return route.fulfill({
        contentType: 'application/json',
        json: {
          data: {
            products: [
              {
                id: 'prod-1',
                name: 'Premium Cotton Tee',
                variants: [
                  {
                    id: 'var-1',
                    sku: 'SKU-A',
                    trackingMode: 'quantity',
                    attributes: [{ name: 'Size', value: 'M' }],
                  },
                ],
              },
            ],
          },
        },
      });
    } 

    // 6. Main Dashboard Queries (Inventory Levels)
    if (query.includes('inventoryItems')) {
      return route.fulfill({
        contentType: 'application/json',
        json: {
          data: {
            inventoryItems: [
              { id: 'inv-1', sku: 'SKU-A', locationId: 'loc-1', quantity: 45, version: 1 },
            ],
          },
        },
      });
    } 

    // 7. Serial Number Tracking Trace
    if (query.includes('query TraceSerial') || query.includes('serializedItemBySerial(')) {
      return route.fulfill({
        contentType: 'application/json',
        json: {
          data: {
            serializedItemBySerial: {
              id: 'sn-1',
              variantId: 'var-1',
              serialNumber: variables.serialNumber || 'SN123',
              tenantId: 'tenant-1',
              locationId: 'loc-1',
              status: 'InStock',
              history: [
                {
                  from: 'None',
                  to: 'InStock',
                  reason: 'Initial Onboarding Receipt',
                  actor: 'admin-user',
                  occurredAt: '2026-05-29T22:00:00Z',
                  referenceId: 'ref-100',
                },
              ],
            },
          },
        },
      });
    }
    
    // 8. Mutations Mocking
    if (query.includes('mutation CreateProd') || query.includes('createProduct(')) {
      return route.fulfill({ contentType: 'application/json', json: { data: { createProduct: true } } });
    }
    if (query.includes('mutation AddVar') || query.includes('addProductVariant(')) {
      return route.fulfill({ contentType: 'application/json', json: { data: { addProductVariant: true } } });
    }
    if (query.includes('mutation AssignBC') || query.includes('assignBarcode(')) {
      return route.fulfill({ contentType: 'application/json', json: { data: { assignBarcode: true } } });
    }
    if (query.includes('mutation GenBC') || query.includes('generateInternalBarcode(')) {
      return route.fulfill({ contentType: 'application/json', json: { data: { generateInternalBarcode: 'INT-AUTO-999' } } });
    }
    if (query.includes('mutation RevBC') || query.includes('revokeBarcode(')) {
      return route.fulfill({ contentType: 'application/json', json: { data: { revokeBarcode: true } } });
    }
    if (query.includes('mutation CreateOnboarding') || query.includes('createStockOnboarding(')) {
      return route.fulfill({ contentType: 'application/json', json: { data: { createStockOnboarding: true } } });
    }
    if (query.includes('mutation SaveOnboarding') || query.includes('saveStockOnboardingItems(')) {
      return route.fulfill({ contentType: 'application/json', json: { data: { saveStockOnboardingItems: true } } });
    }
    if (query.includes('mutation SubmitOnboarding') || query.includes('submitStockOnboarding(')) {
      return route.fulfill({ contentType: 'application/json', json: { data: { submitStockOnboarding: true } } });
    }
    if (query.includes('mutation PostGL') || query.includes('createJournalEntry(')) {
      return route.fulfill({ contentType: 'application/json', json: { data: { createJournalEntry: true } } });
    }
    if (query.includes('mutation DispatchScan') || query.includes('dispatchBarcodeScan(')) {
      return route.fulfill({ contentType: 'application/json', json: { data: { dispatchBarcodeScan: true } } });
    }

    // Default empty success fallback
    return route.fulfill({
      contentType: 'application/json',
      json: { data: {} },
    });
  });

  // Set mock authenticated session in localStorage prior to page loads
  await page.goto('/');
  await page.evaluate(() => {
    const mockPayload = { tenantId: 'tenant-1', actorId: 'admin-user', role: 'admin' };
    const mockToken = 'mockHeader.' + btoa(JSON.stringify(mockPayload)) + '.mockSignature';
    localStorage.setItem('auth_token', mockToken);
  });
  // Navigate again to boot authenticated dashboard layout
  await page.goto('/');
});

test.describe('GraphQL DDD Inventory Management Dashboard E2E Tests', () => {
  
  test('Dashboard loads metrics and inventory charts correctly', async ({ page }) => {
    await page.goto('/');

    // Assert main header titles
    await expect(page.locator('h1')).toContainText('Dashboard');

    // Assert that metric counters are loaded
    await expect(page.locator('.stat-card').first()).toBeVisible();

    // Verify the inventory items list is visible and SKU-A quantity of 45 is rendered
    await expect(page.locator('text=SKU-A')).toBeVisible();
    await expect(page.locator('.stat-value').first()).toContainText('45');
  });

  test('Catalog tab lets user manage products, add variants, and assign barcodes', async ({ page }) => {
    await page.goto('/');

    // Navigate to Product Catalog tab
    await page.click('text=Product Catalog');

    // Confirm catalog structure
    await expect(page.locator('h2:has-text("Create Product")')).toBeVisible();
    await expect(page.locator('td:has-text("Premium Cotton Tee")')).toBeVisible();

    // Select product to edit/manage variants
    await page.click('button:has-text("Manage Variants")');

    // Verify variants section appeared
    await expect(page.locator('h2:has-text("Add Variant to: Premium Cotton Tee")')).toBeVisible();
    await expect(page.locator('strong:has-text("SKU-A")')).toBeVisible();

    // Expand manual barcode assignment
    await page.click('button:has-text("+ Assign Custom Barcode")');

    // Fill in custom barcode assignment form
    await page.fill('input[placeholder="e.g. 123456789012"]', '987654321098');
    await page.selectOption('select:has-text("UPC-A")', 'ean13'); // Symbology dropdown
    await page.check('input[type="checkbox"]'); // Primary flag
    
    // Save barcode assignment
    await page.click('button:has-text("Save Assignment")');

    // Success notification check
    await expect(page.locator('.alert-box')).toContainText('Barcode successfully assigned.');
  });

  test('Scanning simulator simulates scan dispatching and lists scan events', async ({ page }) => {
    await page.goto('/');

    // Navigate to live scanning tab
    await page.click('text=Scan Dispatcher');

    // Verify Live scan form displays
    await expect(page.locator('h2:has-text("Live Barcode Scan Dispatcher")')).toBeVisible();

    // Dispatch scan event
    await page.fill('input[placeholder="Scan / Type Barcode Value"]', '123456789012');
    await page.selectOption('select:has-text("Point of Sale")', 'receiving'); // Receiving workflow
    await page.fill('input[type="number"]', '5'); // Scan Amount
    await page.click('button:has-text("Dispatch Scan Trigger")');

    // Assert logged timeline item reflects the scan event and success status
    await expect(page.locator('.timeline')).toContainText('RECEIVING Scan');
    await expect(page.locator('.timeline')).toContainText('Scanned Value: 123456789012');
    await expect(page.locator('.timeline')).toContainText('Success');
  });

  test('Accounting tab allows manual journal entries posting', async ({ page }) => {
    await page.goto('/');

    // Navigate to general ledger tab
    await page.click('text=General Ledger');

    // Assert General Ledger Ingestion section
    await expect(page.locator('h2:has-text("Manual Journal Ingestion")')).toBeVisible();

    // Fill in description
    await page.fill('input[placeholder="e.g. Post Month-End Inventory Adjustments"]', 'E2E Testing Adjustments');

    // Fill in line values
    const accountCodeInputs = page.locator('input[placeholder="Account Code"]');
    const amountCentsInputs = page.locator('input[placeholder="Amount (Cents)"]');
    
    await accountCodeInputs.nth(0).fill('1010');
    await amountCentsInputs.nth(0).fill('20000');
    
    await accountCodeInputs.nth(1).fill('2020');
    await amountCentsInputs.nth(1).fill('20000');

    // Handle confirm dialog
    page.once('dialog', dialog => dialog.accept());

    // Post balanced entry
    await page.click('button:has-text("Post Balanced Journal Entry")');

    // Success notification check
    await expect(page.locator('.alert-box')).toContainText('Double-entry general ledger journal posted successfully!');
  });

  test('Serial number tracker retrieves item status transitions history', async ({ page }) => {
    await page.goto('/');

    // Navigate to serial tracking tab
    await page.click('text=Serial Tracking');

    // Assert trace page elements
    await expect(page.locator('h2:has-text("Trace Serialized Item")')).toBeVisible();

    // Search serial number
    await page.fill('input[placeholder="e.g. SN123"]', 'SN-E2E-TEST');
    await page.click('button:has-text("Trace History Timeline")');

    // Assert traced status details render correctly
    await expect(page.locator('h2:has-text("Trace Details:")')).toBeVisible();
    await expect(page.locator('.timeline')).toContainText('Initial Onboarding Receipt');
    await expect(page.locator('.timeline')).toContainText('Actor: admin-user');
  });

  test('Viewer role enforces read-only access in dashboard layout', async ({ page }) => {
    // Override default admin token setup in localStorage to simulate viewer role
    await page.goto('/');
    await page.evaluate(() => {
      const mockPayload = { tenantId: 'tenant-1', actorId: 'viewer-user', role: 'viewer' };
      const mockToken = 'mockHeader.' + btoa(JSON.stringify(mockPayload)) + '.mockSignature';
      localStorage.setItem('auth_token', mockToken);
    });
    
    // Refresh/load page with viewer role session
    await page.goto('/');

    // Check that unauthorized navigation tabs are not visible
    await expect(page.locator('text=General Ledger')).not.toBeVisible();
    await expect(page.locator('text=Scan Dispatcher')).not.toBeVisible();
    await expect(page.locator('text=Opening Balances')).not.toBeVisible();
    await expect(page.locator('text=Shopify Integrations')).not.toBeVisible();

    // Check that authorized navigation tabs are visible
    await expect(page.locator('text=Product Catalog')).toBeVisible();

    // Navigate to Product Catalog
    await page.click('text=Product Catalog');

    // Verify Create Product form is hidden for viewers
    await expect(page.locator('h2:has-text("Create Product")')).not.toBeVisible();
  });
});

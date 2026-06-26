import { useState, useEffect } from 'react'
import { createClient } from 'graphql-ws'

// --- Interface Definitions ---
interface Item {
  variantId: string;
  quantity: number;
  unitCostCents: number;
}

interface StockOnboarding {
  id: string;
  tenantId: string;
  locationId: string;
  status: 'draft' | 'submitted';
  asOfDate: string;
  items: Item[];
}

interface Barcode {
  value: string;
  symbology: string;
}

interface BarcodeAssignment {
  id: string;
  sku: string;
  barcode: Barcode;
  source: string;
  isPrimary: boolean;
  assignedAt: string;
}

interface ProductVariant {
  id: string;
  sku: string;
  trackingMode: 'quantity' | 'serial' | 'lot';
  attributes: { name: string; value: string }[];
  barcodes?: BarcodeAssignment[];
}

interface Product {
  id: string;
  name: string;
  variants: ProductVariant[];
}

interface JournalLine {
  accountCode: string;
  amountCents: number;
  type: 'debit' | 'credit';
  memo?: string;
}

interface JournalEntry {
  id: string;
  tenantId: string;
  date: string;
  description: string;
  method: 'cash' | 'accrual';
  referenceId?: string;
  lines: JournalLine[];
}

interface StatusTransition {
  from: string;
  to: string;
  reason: string;
  actor: string;
  occurredAt: string;
  referenceId?: string;
}

interface SerializedItem {
  id: string;
  variantId: string;
  serialNumber: string;
  tenantId: string;
  locationId: string;
  status: string;
  history: StatusTransition[];
}

interface ShopifyConnection {
  id: string;
  tenantId: string;
  platform: string;
  storeDomain: string;
  isActive: boolean;
}

interface InventoryItem {
  id: string;
  sku: string;
  locationId: string;
  quantity: number;
  version: number;
}

type Tab = 'dashboard' | 'onboarding' | 'products' | 'scanning' | 'ledger' | 'serials' | 'shopify';

const Spinner = () => (
  <svg className="spinner" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <circle className="spinner-track" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
    <path className="spinner-head" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [loginTenant, setLoginTenant] = useState('tenant-1');
  const [loginActor, setLoginActor] = useState('admin-user');
  const [loginRole, setLoginRole] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [role, setRole] = useState('admin');

  const [tenantId, setTenantId] = useState('tenant-1');
  const [locationId, setLocationId] = useState('loc-1');
  const [actorId, setActorId] = useState('admin-user');

  // --- Shared Status States ---
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- Loaded Data States ---
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [onboardings, setOnboardings] = useState<StockOnboarding[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [shopifyConns, setShopifyConns] = useState<ShopifyConnection[]>([]);

  // --- Selection / Draft States ---
  const [selectedOnboarding, setSelectedOnboarding] = useState<StockOnboarding | null>(null);
  const [onboardingItems, setOnboardingItems] = useState<Item[]>([{ variantId: '', quantity: 0, unitCostCents: 0 }]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // --- Form Inputs ---
  const [newProdName, setNewProdName] = useState('');
  const [newProdId, setNewProdId] = useState('');
  
  const [newVarSku, setNewVarSku] = useState('');
  const [newVarTracking, setNewVarTracking] = useState<'quantity' | 'serial' | 'lot'>('quantity');
  const [newVarAttrs, setNewVarAttrs] = useState<{ name: string; value: string }[]>([{ name: '', value: '' }]);

  const [assignSku, setAssignSku] = useState('');
  const [assignVal, setAssignVal] = useState('');
  const [assignSymbology, setAssignSymbology] = useState('upc_a');
  const [assignSource, setAssignSource] = useState('supplier');
  const [assignPrimary, setAssignPrimary] = useState(true);

  const [scanVal, setScanVal] = useState('');
  const [scanContext, setScanContext] = useState<'pos' | 'receiving' | 'cycle_count'>('pos');
  const [scanAmount, setScanAmount] = useState(1);
  const [scanActualQty, setScanActualQty] = useState(0);
  const [scanHistory, setScanHistory] = useState<{ time: string; scan: string; context: string; status: string }[]>([]);

  const [traceSerialNum, setTraceSerialNum] = useState('');
  const [tracedItem, setTracedItem] = useState<SerializedItem | null>(null);

  const [newShopifyId, setNewShopifyId] = useState('');
  const [newShopifyDomain, setNewShopifyDomain] = useState('');
  const [newShopifyToken, setNewShopifyToken] = useState('');

  const [newJournalDesc, setNewJournalDesc] = useState('');
  const [newJournalMethod, setNewJournalMethod] = useState<'cash' | 'accrual'>('accrual');
  const [newJournalLines, setNewJournalLines] = useState<JournalLine[]>([
    { accountCode: '1000', amountCents: 0, type: 'debit', memo: '' },
    { accountCode: '2000', amountCents: 0, type: 'credit', memo: '' }
  ]);

  // Decode JWT details to synchronize client parameters
  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.tenantId) setTenantId(payload.tenantId);
        if (payload.actorId) setActorId(payload.actorId);
        if (payload.role) setRole(payload.role);
      } catch (err) {
        console.error('Failed to parse token payload:', err);
      }
    }
  }, [token]);

  // Redirect to dashboard if the active tab is not allowed for the role
  useEffect(() => {
    const allowedTabs: Tab[] = ['dashboard'];
    if (role === 'admin') {
      allowedTabs.push('onboarding', 'products', 'scanning', 'ledger', 'serials', 'shopify');
    } else if (role === 'warehouse_operator') {
      allowedTabs.push('products', 'scanning', 'serials');
    } else if (role === 'accountant') {
      allowedTabs.push('onboarding', 'products', 'ledger');
    } else if (role === 'viewer') {
      allowedTabs.push('products', 'serials');
    }
    
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [role, activeTab]);

  // --- GraphQL Fetch Wrapper ---
  const fetchGraphql = async (query: string, variables = {}, customToken?: string) => {
    try {
      const activeToken = customToken || token || localStorage.getItem('auth_token');
      const headers: any = { 'Content-Type': 'application/json' };
      if (activeToken && activeToken !== 'NONE') {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }

      const response = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables })
      });
      const result = await response.json();
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      return result.data;
    } catch (err: any) {
      console.error('GraphQL Error:', err);
      throw err;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const data = await fetchGraphql(`mutation Login($tenant: ID!, $actor: ID!, $role: String, $password: String) {
        login(tenantId: $tenant, actorId: $actor, role: $role, password: $password)
      }`, { tenant: loginTenant, actor: loginActor, role: loginRole, password: loginPassword }, 'NONE');

      const jwtToken = data.login;
      localStorage.setItem('auth_token', jwtToken);
      setToken(jwtToken);
      setMessage({ type: 'success', text: 'Authentication successful. Secure session started!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Login failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setRole('viewer');
    setMessage({ type: 'success', text: 'Logged out successfully.' });
  };

  // --- Data Loading Effects ---
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const invData = await fetchGraphql(`query { inventoryItems { id sku locationId quantity version } }`);
      setInventoryItems(invData.inventoryItems || []);

      const prodData = await fetchGraphql(`query { 
        products { 
          id name 
          variants { 
            id sku trackingMode 
            attributes { name value } 
          } 
        } 
      }`);
      
      const rawProducts = prodData.products || [];
      // Resolve barcodes for each variant to complete details
      const enrichedProducts = await Promise.all(rawProducts.map(async (p: Product) => {
        const variants = await Promise.all(p.variants.map(async (v: ProductVariant) => {
          try {
            const bcData = await fetchGraphql(`query GetBarcodes($sku: String!) {
              barcodeSet(sku: $sku) {
                assignments { id sku barcode { value symbology } source isPrimary assignedAt }
              }
            }`, { sku: v.sku });
            return { ...v, barcodes: bcData.barcodeSet?.assignments || [] };
          } catch {
            return { ...v, barcodes: [] };
          }
        }));
        return { ...p, variants };
      }));

      setProducts(enrichedProducts);

      const connData = await fetchGraphql(`query GetShopify($tenant: ID!) {
        shopifyConnections(tenantId: $tenant) { id tenantId platform storeDomain isActive }
      }`, { tenant: tenantId });
      setShopifyConns(connData.shopifyConnections || []);

      const glData = await fetchGraphql(`query GetGL($tenant: ID!) {
        journalEntries(tenantId: $tenant) { 
          id tenantId date description method referenceId 
          lines { accountCode amountCents type memo }
        }
      }`, { tenant: tenantId });
      setJournals(glData.journalEntries || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to connect to GraphQL Server.' });
    } finally {
      setLoading(false);
    }
  };

  const loadOnboardings = async () => {
    setLoading(true);
    try {
      const data = await fetchGraphql(`query GetOnboardings($tenant: ID!) {
        stockOnboardings(tenantId: $tenant) {
          id tenantId locationId status asOfDate
          items { variantId quantity unitCostCents }
        }
      }`, { tenant: tenantId });
      setOnboardings(data.stockOnboardings || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    setMessage(null);
    if (activeTab === 'dashboard') {
      loadDashboardData();
    } else if (activeTab === 'onboarding') {
      loadOnboardings();
    } else if (activeTab === 'products') {
      loadDashboardData(); // Catalog list loads together
    } else if (activeTab === 'ledger') {
      loadDashboardData();
    } else if (activeTab === 'shopify') {
      loadDashboardData();
    }
  }, [activeTab, tenantId, token]);

  // Keep selected product synchronized with updated catalog data
  useEffect(() => {
    if (selectedProduct) {
      const updated = products.find(p => p.id === selectedProduct.id);
      if (updated) {
        setSelectedProduct(updated);
      }
    }
  }, [products]);

  // Set up real-time barcode scanning subscriptions over WebSocket connection
  useEffect(() => {
    if (!token) return;

    const wsClient = createClient({
      url: 'ws://localhost:4000/graphql',
      connectionParams: () => {
        const activeToken = token || localStorage.getItem('auth_token');
        return activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
      },
    });

    const unsubscribe = wsClient.subscribe(
      {
        query: `subscription OnBarcodeScanned($tenant: ID!) {
          barcodeScanned(tenantId: $tenant) {
            scanValue
            symbology
            context
            status
            time
            payload
          }
        }`,
        variables: { tenant: tenantId },
      },
      {
        next: (data: any) => {
          const scan = data?.data?.barcodeScanned;
          if (scan) {
            // Append incoming scan event to live simulator logs timeline dynamically
            setScanHistory(prev => [
              {
                time: scan.time,
                scan: scan.scanValue,
                context: scan.context,
                status: scan.status
              },
              ...prev
            ]);
            // Display alert banner feedback
            setMessage({
              type: scan.status.startsWith('Error') ? 'error' : 'success',
              text: `Live scan received: ${scan.scanValue} [${scan.context.toUpperCase()}] -> ${scan.status}`
            });
          }
        },
        error: (err: any) => {
          console.error('Subscription WebSocket Error:', err);
        },
        complete: () => {
          console.log('Subscription completed.');
        },
      }
    );

    return () => {
      unsubscribe();
      wsClient.dispose();
    };
  }, [token, tenantId]);

  // --- Mutation Responders ---

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetchGraphql(`mutation CreateProd($id: ID!, $name: String!) {
        createProduct(id: $id, name: $name)
      }`, { id: newProdId, name: newProdName });
      setMessage({ type: 'success', text: `Product ${newProdName} created.` });
      setNewProdId('');
      setNewProdName('');
      loadDashboardData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setLoading(true);
    try {
      const attributes = newVarAttrs.filter(a => a.name !== '' && a.value !== '');
      await fetchGraphql(`mutation AddVar($productId: ID!, $sku: String!, $attributes: [AttributeInput!]!, $trackingMode: TrackingMode!) {
        addProductVariant(productId: $productId, sku: $sku, attributes: $attributes, trackingMode: $trackingMode)
      }`, {
        productId: selectedProduct.id,
        sku: newVarSku,
        attributes,
        trackingMode: newVarTracking
      });
      setMessage({ type: 'success', text: `Variant ${newVarSku} added.` });
      setNewVarSku('');
      setNewVarAttrs([{ name: '', value: '' }]);
      loadDashboardData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignBarcode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetchGraphql(`mutation AssignBC($input: AssignBarcodeInput!) {
        assignBarcode(input: $input)
      }`, {
        input: {
          sku: assignSku,
          barcodeValue: assignVal,
          symbology: assignSymbology,
          source: assignSource,
          makePrimary: assignPrimary
        }
      });
      setMessage({ type: 'success', text: 'Barcode successfully assigned.' });
      setAssignSku('');
      setAssignVal('');
      loadDashboardData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBarcode = async (sku: string) => {
    setLoading(true);
    try {
      const data = await fetchGraphql(`mutation GenBC($sku: String!, $tenant: ID!) {
        generateInternalBarcode(sku: $sku, tenantId: $tenant)
      }`, { sku, tenant: tenantId });
      setMessage({ type: 'success', text: `Generated barcode: ${data.generateInternalBarcode}` });
      loadDashboardData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeBarcode = async (sku: string, assignmentId: string) => {
    if (!window.confirm(`Are you sure you want to revoke this barcode from SKU ${sku}? This action cannot be undone.`)) {
      return;
    }
    try {
      await fetchGraphql(`mutation RevBC($input: RevokeBarcodeInput!) {
        revokeBarcode(input: $input)
      }`, { input: { sku, assignmentId } });
      setMessage({ type: 'success', text: 'Barcode revoked.' });
      loadDashboardData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOnboarding = async () => {
    const onbId = Math.random().toString(36).substring(2, 15);
    setLoading(true);
    try {
      await fetchGraphql(`mutation CreateOnb($input: CreateStockOnboardingInput!) {
        createStockOnboarding(input: $input)
      }`, {
        input: {
          id: onbId,
          tenantId,
          locationId,
          asOfDate: new Date().toISOString()
        }
      });
      setMessage({ type: 'success', text: `Draft onboarding sheet ${onbId} created.` });
      loadOnboardings();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOnboardingItems = async (onbId: string) => {
    setLoading(true);
    try {
      const items = onboardingItems.map(i => ({
        variantId: i.variantId,
        quantity: Number(i.quantity),
        unitCostCents: Number(i.unitCostCents)
      }));
      await fetchGraphql(`mutation SaveItems($input: SaveStockOnboardingItemsInput!) {
        saveStockOnboardingItems(input: $input)
      }`, {
        input: { id: onbId, items }
      });
      setMessage({ type: 'success', text: 'Draft items saved successfully.' });
      loadOnboardings();
      setSelectedOnboarding(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOnboarding = async (onbId: string) => {
    if (!window.confirm('Are you sure you want to lock and post this onboarding sheet? This will permanently post to the General Ledger and cannot be reversed.')) {
      return;
    }
    try {
      await fetchGraphql(`mutation SubmitOnb($id: ID!, $actor: ID!) {
        submitStockOnboarding(id: $id, actorId: $actor)
      }`, { id: onbId, actor: actorId });
      setMessage({ type: 'success', text: 'Onboarding items posted to General Ledger and lock completed.' });
      loadOnboardings();
      setSelectedOnboarding(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDispatchScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = { locationId };
      if (scanContext === 'pos' || scanContext === 'receiving') {
        payload.amount = Number(scanAmount);
      } else if (scanContext === 'cycle_count') {
        payload.actualQuantity = Number(scanActualQty);
      }

      await fetchGraphql(`mutation DispatchScan($rawScan: String!, $context: ScanContext!, $payload: ScanPayloadInput!) {
        dispatchBarcodeScan(rawScan: $rawScan, context: $context, payload: $payload)
      }`, { rawScan: scanVal, context: scanContext, payload });

      setScanHistory([
        { time: new Date().toLocaleTimeString(), scan: scanVal, context: scanContext, status: 'Success' },
        ...scanHistory
      ]);
      setScanVal('');
      setMessage({ type: 'success', text: 'Scan successfully routed to workflow context.' });
    } catch (err: any) {
      setScanHistory([
        { time: new Date().toLocaleTimeString(), scan: scanVal, context: scanContext, status: `Error: ${err.message}` },
        ...scanHistory
      ]);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleTraceSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    setTracedItem(null);
    setLoading(true);
    try {
      const data = await fetchGraphql(`query Trace($serial: String!, $tenant: ID!) {
        serializedItemBySerial(serialNumber: $serial, tenantId: $tenant) {
          id variantId serialNumber tenantId locationId status
          history { from to reason actor occurredAt referenceId }
        }
      }`, { serial: traceSerialNum, tenant: tenantId });
      
      if (!data.serializedItemBySerial) {
        throw new Error(`No serialized item found for serial number ${traceSerialNum}`);
      }
      setTracedItem(data.serializedItemBySerial);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectShopify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetchGraphql(`mutation ConnectShopify($input: ConnectShopifyInput!) {
        connectShopifyStore(input: $input)
      }`, {
        input: {
          id: newShopifyId,
          tenantId,
          storeDomain: newShopifyDomain,
          accessToken: newShopifyToken
        }
      });
      setMessage({ type: 'success', text: 'Shopify Connection added successfully.' });
      setNewShopifyId('');
      setNewShopifyDomain('');
      setNewShopifyToken('');
      loadDashboardData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePostJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm('Are you sure you want to post this journal entry? This will permanently post to the General Ledger and cannot be reversed.')) {
      return;
    }
    setLoading(true);
    try {
      const entryId = 'j-entry-' + Math.random().toString(36).substring(2, 10);
      const lines = newJournalLines.map(l => ({
        accountCode: l.accountCode,
        amountCents: Number(l.amountCents),
        type: l.type,
        memo: l.memo
      }));

      await fetchGraphql(`mutation PostGL($input: CreateJournalEntryInput!) {
        createJournalEntry(input: $input)
      }`, {
        input: {
          id: entryId,
          tenantId,
          date: new Date().toISOString(),
          description: newJournalDesc,
          method: newJournalMethod,
          lines
        }
      });

      setMessage({ type: 'success', text: 'Double-entry general ledger journal posted successfully!' });
      setNewJournalDesc('');
      setNewJournalLines([
        { accountCode: '1000', amountCents: 0, type: 'debit', memo: '' },
        { accountCode: '2000', amountCents: 0, type: 'credit', memo: '' }
      ]);
      loadDashboardData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', background: 'var(--bg)', padding: '2rem' }}>
        <div className="glass-panel" style={{ width: '400px', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignSelf: 'center' }}>
          <div className="brand-section" style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div className="brand-icon" style={{ fontSize: '2.5rem' }}>📦</div>
            <div className="brand-name" style={{ fontSize: '1.75rem' }}>DDD Inventory</div>
          </div>
          
          <h2 style={{ textAlign: 'center', color: 'var(--text)', margin: 0, fontWeight: 600 }}>Secure Session Startup</h2>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>Enter credentials to generate authorization token</p>

          {message && (
            <div role="alert" aria-live="assertive" className={`alert-box ${message.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ margin: 0 }}>
              <strong>{message.type === 'success' ? '✓ Success: ' : '✗ Error: '}</strong> {message.text}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label htmlFor="loginTenant">Tenant ID</label>
              <input id="loginTenant" value={loginTenant} onChange={e => setLoginTenant(e.target.value)} required placeholder="e.g. tenant-1" />
            </div>
            <div className="form-group">
              <label htmlFor="loginActor">User / Actor ID</label>
              <input id="loginActor" value={loginActor} onChange={e => setLoginActor(e.target.value)} required placeholder="e.g. admin-user" />
            </div>
            <div className="form-group">
              <label htmlFor="loginPassword">Password</label>
              <input id="loginPassword" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required placeholder="Password" />
            </div>
            <div className="form-group">
              <label htmlFor="loginRole">Assign Role</label>
              <select id="loginRole" value={loginRole} onChange={e => setLoginRole(e.target.value)} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)' }}>
                <option value="admin">Admin</option>
                <option value="warehouse_operator">Warehouse Operator</option>
                <option value="accountant">Accountant</option>
                <option value="viewer">Viewer (Read-Only)</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }} disabled={loading}>
              {loading ? <><Spinner /> Authenticating...</> : 'Sign In & Verify'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          <div className="brand-section">
            <div className="brand-icon">📦</div>
            <div className="brand-name">GQL-DDD Inventory</div>
          </div>
          <nav className="nav-links">
            <div role="button" tabIndex={0} className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab('dashboard'); } }}>
              📊 Status Overview
            </div>
            {(role === 'admin' || role === 'accountant') && (
              <div role="button" tabIndex={0} className={`nav-link ${activeTab === 'onboarding' ? 'active' : ''}`} onClick={() => setActiveTab('onboarding')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab('onboarding'); } }}>
                📝 Opening Balances
              </div>
            )}
            {(role === 'admin' || role === 'warehouse_operator' || role === 'accountant' || role === 'viewer') && (
              <div role="button" tabIndex={0} className={`nav-link ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab('products'); } }}>
                🗂️ Product Catalog
              </div>
            )}
            {(role === 'admin' || role === 'warehouse_operator') && (
              <div role="button" tabIndex={0} className={`nav-link ${activeTab === 'scanning' ? 'active' : ''}`} onClick={() => setActiveTab('scanning')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab('scanning'); } }}>
                🚨 Scan Dispatcher
              </div>
            )}
            {(role === 'admin' || role === 'accountant') && (
              <div role="button" tabIndex={0} className={`nav-link ${activeTab === 'ledger' ? 'active' : ''}`} onClick={() => setActiveTab('ledger')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab('ledger'); } }}>
                ⚖️ General Ledger
              </div>
            )}
            {(role === 'admin' || role === 'warehouse_operator' || role === 'viewer') && (
              <div role="button" tabIndex={0} className={`nav-link ${activeTab === 'serials' ? 'active' : ''}`} onClick={() => setActiveTab('serials')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab('serials'); } }}>
                🔍 Serial Tracking
              </div>
            )}
            {role === 'admin' && (
              <div role="button" tabIndex={0} className={`nav-link ${activeTab === 'shopify' ? 'active' : ''}`} onClick={() => setActiveTab('shopify')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab('shopify'); } }}>
                🔌 Shopify Integrations
              </div>
            )}
          </nav>
        </div>
        <div className="sidebar-footer">
          v1.0.0 (PostgreSQL Active)
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Top Header controls */}
        <header className="top-header">
          <div className="header-title">
            <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
            <p>Control center for your DDD domains</p>
          </div>
          <div className="header-controls" style={{ alignItems: 'center' }}>
            <div className="control-item">
              <label>Tenant</label>
              <span className="badge badge-info" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', minWidth: '80px', textAlign: 'center' }}>{tenantId}</span>
            </div>
            <div className="control-item">
              <label htmlFor="headerLocation">Location</label>
              <input id="headerLocation" value={locationId} onChange={e => setLocationId(e.target.value)} style={{ width: '100px' }} />
            </div>
            <div className="control-item">
              <label>User</label>
              <span className="badge badge-success" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', minWidth: '100px', textAlign: 'center' }}>{actorId}</span>
            </div>
            <div className="control-item">
              <label>Role</label>
              <span className="badge badge-warning" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', minWidth: '100px', textAlign: 'center', textTransform: 'capitalize' }}>{role.replace('_', ' ')}</span>
            </div>
            <button className="btn btn-secondary" aria-label="Logout securely" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', marginLeft: '1rem', cursor: 'pointer' }} onClick={handleLogout}>
              Logout 🔓
            </button>
          </div>
        </header>

        {/* Global Messages */}
        {message && (
          <div role="alert" aria-live="assertive" className={`alert-box ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            <strong>{message.type === 'success' ? '✓ Success: ' : '✗ Error: '}</strong> {message.text}
          </div>
        )}

        {/* --- TABS --- */}

        {/* 1. Dashboard tab */}
        {activeTab === 'dashboard' && (
          <>
            <div className="grid-cols-4">
              <div className="stat-card">
                <span className="stat-title">Inventory Levels</span>
                <span className="stat-value">{inventoryItems.reduce((acc, curr) => acc + curr.quantity, 0)}</span>
                <span className="stat-desc">Total pieces across {new Set(inventoryItems.map(i => i.locationId)).size} locations</span>
              </div>
              <div className="stat-card accent">
                <span className="stat-title">Catalog SKU Count</span>
                <span className="stat-value">{products.reduce((acc, curr) => acc + curr.variants.length, 0)}</span>
                <span className="stat-desc">Spanning {products.length} parent products</span>
              </div>
              <div className="stat-card">
                <span className="stat-title">Journal Logs</span>
                <span className="stat-value">{journals.length}</span>
                <span className="stat-desc">Active double-entry sheets</span>
              </div>
              <div className="stat-card accent">
                <span className="stat-title">Shopify Connects</span>
                <span className="stat-value">{shopifyConns.filter(c => c.isActive).length}</span>
                <span className="stat-desc">Sync pipelines active</span>
              </div>
            </div>

            <div className="glass-panel">
              <h2 className="form-section-title">Physical Stock Levels</h2>
              {loading ? <p>Loading stock levels...</p> : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Location</th>
                        <th>Quantity On Hand</th>
                        <th>Prisma Row ID</th>
                        <th>Version</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No inventory stock exists yet. Post an opening balance to initialize!</td>
                        </tr>
                      ) : inventoryItems.map(item => (
                        <tr key={item.id}>
                          <td><strong>{item.sku}</strong></td>
                          <td><span className="badge badge-info">{item.locationId}</span></td>
                          <td>{item.quantity} units</td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.id}</td>
                          <td>v{item.version}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* 2. Onboarding (Opening Balances) tab */}
        {activeTab === 'onboarding' && (
          <div className="grid-cols-2">
            <div className="glass-panel" style={{ alignSelf: 'start' }}>
              <h2 className="form-section-title">Ingest Sheets</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Stock onboarding sheets follow a strict workflow: Draft (add/remove items) → Submitted (processes and writes ledger entries).
              </p>
              <button className={"btn btn-primary" + (loading ? " btn-loading" : "")} onClick={handleCreateOnboarding} disabled={loading}>
                + Create Draft Onboarding Sheet
              </button>

              <div className="table-wrapper" style={{ marginTop: '1.5rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Sheet ID</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onboardings.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No onboarding sheets found.</td>
                      </tr>
                    ) : onboardings.map(o => (
                      <tr key={o.id}>
                        <td style={{ fontSize: '0.8rem' }}><strong>{o.id}</strong></td>
                        <td>{o.locationId}</td>
                        <td>
                          <span className={`badge ${o.status === 'submitted' ? 'badge-success' : 'badge-warning'}`}>
                            {o.status}
                          </span>
                        </td>
                        <td>
                          {o.status === 'draft' ? (
                            <div className="flex-gap-1">
                              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => {
                                setSelectedOnboarding(o);
                                setOnboardingItems(o.items.length > 0 ? o.items : [{ variantId: '', quantity: 0, unitCostCents: 0 }]);
                              }}>
                                Edit
                              </button>
                              <button className={"btn btn-accent" + (loading ? " btn-loading" : "")} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handleSubmitOnboarding(o.id)} disabled={loading}>
                                Lock & Post
                              </button>
                            </div>
                          ) : (
                            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => {
                              setSelectedOnboarding(o);
                              setOnboardingItems(o.items);
                            }}>
                              View
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedOnboarding && (
              <div className="glass-panel">
                <h2 className="form-section-title">
                  {selectedOnboarding.status === 'draft' ? 'Edit Draft: ' : 'View Sheet: '} {selectedOnboarding.id}
                </h2>
                
                {onboardingItems.map((item, idx) => (
                  <div key={idx} className="items-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr auto' }}>
                    <div className="form-group">
                      <label htmlFor={`onb-var-${idx}`}>Variant UUID</label>
                      <input
                        id={`onb-var-${idx}`}
                        value={item.variantId} 
                        disabled={selectedOnboarding.status === 'submitted'}
                        placeholder="Variant UUID"
                        required
                        onChange={e => {
                          const updated = [...onboardingItems];
                          updated[idx].variantId = e.target.value;
                          setOnboardingItems(updated);
                        }} 
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor={`onb-qty-${idx}`}>Quantity</label>
                      <input
                        id={`onb-qty-${idx}`}
                        type="number" 
                        value={item.quantity} 
                        disabled={selectedOnboarding.status === 'submitted'}
                        required
                        onChange={e => {
                          const updated = [...onboardingItems];
                          updated[idx].quantity = Number(e.target.value);
                          setOnboardingItems(updated);
                        }} 
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor={`onb-cost-${idx}`}>Unit Cost (¢)</label>
                      <input
                        id={`onb-cost-${idx}`}
                        type="number" 
                        value={item.unitCostCents} 
                        disabled={selectedOnboarding.status === 'submitted'}
                        required
                        onChange={e => {
                          const updated = [...onboardingItems];
                          updated[idx].unitCostCents = Number(e.target.value);
                          setOnboardingItems(updated);
                        }} 
                      />
                    </div>
                    {selectedOnboarding.status === 'draft' && (
                      <button className="btn btn-danger" aria-label="Remove item" title="Remove item" onClick={() => setOnboardingItems(onboardingItems.filter((_, i) => i !== idx))} style={{ height: '42px', padding: '0 1rem' }}>
                        &times;
                      </button>
                    )}
                  </div>
                ))}

                {selectedOnboarding.status === 'draft' && (
                  <div className="flex-gap-1" style={{ marginTop: '1rem' }}>
                    <button className="btn btn-secondary" onClick={() => setOnboardingItems([...onboardingItems, { variantId: '', quantity: 0, unitCostCents: 0 }])}>
                      + Add Variant Item
                    </button>
                    <button className={"btn btn-primary" + (loading ? " btn-loading" : "")} onClick={() => handleSaveOnboardingItems(selectedOnboarding.id)} disabled={loading}>
                      Save Draft Changes
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. Product Catalog tab */}
        {activeTab === 'products' && (
          <div className="grid-cols-2">
            <div className="glass-panel" style={{ alignSelf: 'start' }}>
              {role === 'admin' && (
                <>
                  <h2 className="form-section-title">Create Product</h2>
                  <form onSubmit={handleCreateProduct}>
                    <div className="form-group">
                      <label htmlFor="newProdId">Product ID (UUID format recommended)</label>
                      <input id="newProdId" value={newProdId} onChange={e => setNewProdId(e.target.value)} placeholder="e.g. 5e06497f-bc3a-446f..." required />
                    </div>
                    <div className="form-group">
                      <label htmlFor="newProdName">Product Name</label>
                      <input id="newProdName" value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="e.g. Premium Cotton Tee" required />
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      {loading ? <><Spinner /> Creating...</> : 'Create Product'}
                    </button>
                  </form>
                  <div style={{ height: '1.5rem' }}></div>
                </>
              )}

              <h2 className="form-section-title">Products List</h2>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Variants Count</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No products in database catalog.</td>
                      </tr>
                    ) : products.map(p => (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {p.id}</div>
                        </td>
                        <td>{p.variants.length} variant(s)</td>
                        <td>
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setSelectedProduct(p)}>
                            Manage Variants
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Product Variants management panel */}
            <div>
              {selectedProduct ? (
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {role === 'admin' && (
                    <div>
                      <h2 className="form-section-title">Add Variant to: {selectedProduct.name}</h2>
                      <form onSubmit={handleAddVariant}>
                        <div className="form-group">
                          <label htmlFor="newVarSku">SKU</label>
                          <input id="newVarSku" value={newVarSku} onChange={e => setNewVarSku(e.target.value)} placeholder="e.g. TEE-BLU-M" required />
                        </div>
                        <div className="form-group">
                          <label htmlFor="newVarTracking">Tracking Mode</label>
                          <select id="newVarTracking" value={newVarTracking} onChange={e => setNewVarTracking(e.target.value as any)}>
                            <option value="quantity">Quantity level tracking</option>
                            <option value="serial">Serial number tracking</option>
                            <option value="lot">Lot tracking</option>
                          </select>
                        </div>
                        
                        <div className="form-group">
                          <label>Variant Attributes (Colors, Sizes, etc.)</label>
                          {newVarAttrs.map((attr, idx) => (
                            <div key={idx} className="flex-gap-1" style={{ marginBottom: '0.5rem' }}>
                              <input aria-label={"Attribute Name " + (idx + 1)} placeholder="Attribute Name" value={attr.name} onChange={e => {
                                const updated = [...newVarAttrs];
                                updated[idx] = { ...updated[idx], name: e.target.value };
                                setNewVarAttrs(updated);
                              }} required={!!attr.value} />
                              <input aria-label={"Attribute Value " + (idx + 1)} placeholder="Value" value={attr.value} onChange={e => {
                                const updated = [...newVarAttrs];
                                updated[idx] = { ...updated[idx], value: e.target.value };
                                setNewVarAttrs(updated);
                              }} required={!!attr.name} />
                              {newVarAttrs.length > 1 && (
                                <button type="button" className="btn btn-danger" aria-label={`Remove attribute ${idx + 1}`} title="Remove attribute" onClick={() => setNewVarAttrs(prev => prev.filter((_, i) => i !== idx))} style={{ height: '42px', padding: '0 1rem' }}>
                                  &times;
                                </button>
                              )}
                            </div>
                          ))}
                          <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', marginBottom: '1rem' }} onClick={() => setNewVarAttrs([...newVarAttrs, { name: '', value: '' }])}>
                            + Add Attribute Row
                          </button>
                        </div>

                        <button type="submit" className={"btn btn-primary" + (loading ? " btn-loading" : "")} style={{ width: '100%' }} disabled={loading}>
                          Add Variant
                        </button>
                      </form>
                    </div>
                  )}

                  <div>
                    <h2 className="form-section-title">Variants & Barcodes</h2>
                    {selectedProduct.variants.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No variants defined.</p> : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {selectedProduct.variants.map(v => (
                          <div key={v.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
                            <div className="flex-between">
                              <strong>{v.sku}</strong>
                              <span className="badge badge-info">{v.trackingMode}</span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                              UUID: {v.id}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                              {v.attributes.map(a => (
                                <span key={a.name} style={{ background: 'rgba(255,255,255,0.05)', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                  {a.name}: {a.value}
                                </span>
                              ))}
                            </div>

                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                              <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Barcodes</span>
                                {(role === 'admin' || role === 'warehouse_operator') && (
                                  <button className={"btn btn-secondary" + (loading ? " btn-loading" : "")} aria-label="Auto generate internal barcode" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleGenerateBarcode(v.sku)} disabled={loading}>
                                    ⚡ Auto Gen Internal
                                  </button>
                                )}
                              </div>

                              {v.barcodes && v.barcodes.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                  {v.barcodes.map(b => (
                                    <div key={b.id} className="flex-between" style={{ background: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                                      <span>
                                        <strong>{b.barcode.value}</strong> ({b.barcode.symbology}) 
                                        {b.isPrimary && <span className="badge badge-success" style={{ marginLeft: '0.5rem', padding: '0.1rem 0.3rem', fontSize: '0.65rem' }}>Primary</span>}
                                      </span>
                                      {(role === 'admin' || role === 'warehouse_operator') ? (
                                        <button type="button" className={"btn btn-danger" + (loading ? " btn-loading" : "")} aria-label={"Revoke barcode " + b.barcode.value} style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem', height: 'auto', marginLeft: '0.5rem' }} onClick={() => handleRevokeBarcode(v.sku, b.id)} disabled={loading}>
                                          Revoke
                                        </button>
                                      ) : <span></span>}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No barcodes assigned.</p>
                              )}

                              {assignSku === v.sku ? (
                                <form onSubmit={handleAssignBarcode} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '8px', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                      <label htmlFor={`assignVal-${v.sku}`} style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Barcode Value</label>
                                      <input 
                                        id={`assignVal-${v.sku}`}
                                        style={{ width: '100%', padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '4px' }}
                                        value={assignVal} 
                                        onChange={e => setAssignVal(e.target.value)} 
                                        placeholder="e.g. 123456789012" 
                                        required 
                                      />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                      <label htmlFor={`assignSymbology-${v.sku}`} style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Symbology</label>
                                      <select 
                                        id={`assignSymbology-${v.sku}`}
                                        style={{ width: '100%', padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '4px' }}
                                        value={assignSymbology} 
                                        onChange={e => setAssignSymbology(e.target.value)}
                                      >
                                        <option value="upc_a">UPC-A</option>
                                        <option value="ean13">EAN-13</option>
                                        <option value="code128">Code 128</option>
                                        <option value="qr">QR Code</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                      <label htmlFor={`assignSource-${v.sku}`} style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Source</label>
                                      <select 
                                        id={`assignSource-${v.sku}`}
                                        style={{ width: '100%', padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '4px' }}
                                        value={assignSource} 
                                        onChange={e => setAssignSource(e.target.value)}
                                      >
                                        <option value="supplier">Supplier</option>
                                        <option value="internal">Internal</option>
                                        <option value="custom">Custom</option>
                                      </select>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '1rem' }}>
                                      <input 
                                        type="checkbox" 
                                        id={`primary-${v.sku}`}
                                        checked={assignPrimary} 
                                        onChange={e => setAssignPrimary(e.target.checked)} 
                                      />
                                      <label htmlFor={`primary-${v.sku}`} style={{ fontSize: '0.75rem', cursor: 'pointer' }}>Primary</label>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                    <button type="submit" className={"btn btn-primary" + (loading ? " btn-loading" : "")} style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} disabled={loading}>
                                      Save Assignment
                                    </button>
                                    <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setAssignSku('')}>
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                (role === 'admin' || role === 'warehouse_operator') && (
                                  <div style={{ marginTop: '0.5rem', textAlign: 'right' }}>
                                    <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => {
                                      setAssignSku(v.sku);
                                      setAssignVal('');
                                      setAssignSymbology('upc_a');
                                      setAssignSource('supplier');
                                      setAssignPrimary(true);
                                    }}>
                                      + Assign Custom Barcode
                                    </button>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="glass-panel flex-center" style={{ height: '200px', color: 'var(--text-muted)' }}>
                  Select a product to view variants, attributes, and manage barcode assignments.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. Scanning live simulator tab */}
        {activeTab === 'scanning' && (
          <div className="grid-cols-2">
            <div className="glass-panel" style={{ alignSelf: 'start' }}>
              <h2 className="form-section-title">Live Barcode Scan Dispatcher</h2>
              <form onSubmit={handleDispatchScan}>
                <div className="form-group">
                  <label htmlFor="scanVal">Scan Barcode Value</label>
                  <input id="scanVal" autoFocus value={scanVal} onChange={e => setScanVal(e.target.value)} placeholder="Scan / Type Barcode Value" required />
                </div>
                <div className="form-group">
                  <label htmlFor="scanContext">Scan Workflow Context</label>
                  <select id="scanContext" value={scanContext} onChange={e => setScanContext(e.target.value as any)}>
                    <option value="pos">Point of Sale (Decrement inventory)</option>
                    <option value="receiving">Warehouse Receiving (Increment inventory)</option>
                    <option value="cycle_count">Cycle Counting (Update actual quantity count)</option>
                  </select>
                </div>

                {(scanContext === 'pos' || scanContext === 'receiving') && (
                  <div className="form-group">
                    <label htmlFor="scanAmount">Quantity / Amount</label>
                    <input id="scanAmount" type="number" value={scanAmount} onChange={e => setScanAmount(Number(e.target.value))} min={1} required />
                  </div>
                )}

                {scanContext === 'cycle_count' && (
                  <div className="form-group">
                    <label htmlFor="scanActualQty">Actual Physical Count (Reconciled)</label>
                    <input id="scanActualQty" type="number" value={scanActualQty} onChange={e => setScanActualQty(Number(e.target.value))} min={0} required />
                  </div>
                )}
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? <><Spinner /> Dispatching...</> : 'Dispatch Scan Trigger'}
                </button>
              </form>
            </div>

            <div className="glass-panel">
              <h2 className="form-section-title">Scan Log Timeline</h2>
              <div className="timeline">
                {scanHistory.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>Dispatcher is ready. Trigger scan events to watch logs...</p>
                ) : scanHistory.map((sh, idx) => (
                  <div key={idx} className={`timeline-item ${sh.status.startsWith('Error') ? 'warning' : 'success'}`}>
                    <div className="timeline-header">
                      <span>{sh.context.toUpperCase()} Scan</span>
                      <span>{sh.time}</span>
                    </div>
                    <div className="timeline-body">
                      Scanned Value: <code>{sh.scan}</code> — Status: <strong style={{ color: sh.status.startsWith('Error') ? 'var(--error)' : 'var(--success)' }}>{sh.status}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. General Ledger (Accounting) tab */}
        {activeTab === 'ledger' && (
          <div className="grid-cols-2">
            <div className="glass-panel" style={{ alignSelf: 'start' }}>
              <h2 className="form-section-title">Manual Journal Ingestion</h2>
              <form onSubmit={handlePostJournal}>
                <div className="form-group">
                  <label htmlFor="journalDesc">Entry Description</label>
                  <input id="journalDesc" value={newJournalDesc} onChange={e => setNewJournalDesc(e.target.value)} placeholder="e.g. Post Month-End Inventory Adjustments" required />
                </div>
                <div className="form-group">
                  <label htmlFor="journalMethod">Accounting Method</label>
                  <select id="journalMethod" value={newJournalMethod} onChange={e => setNewJournalMethod(e.target.value as any)}>
                    <option value="accrual">Accrual-Basis Accounting</option>
                    <option value="cash">Cash-Basis Accounting</option>
                  </select>
                </div>

                <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                  <label>Journal Lines (Must Balance: Debits = Credits)</label>
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => setNewJournalLines([...newJournalLines, { accountCode: '', amountCents: 0, type: 'debit', memo: '' }])}>
                    + Add Line
                  </button>
                </div>

                {newJournalLines.map((line, idx) => (
                  <div key={idx} className="flex-gap-1" style={{ marginBottom: '0.5rem' }}>
                    <input aria-label={"Account Code for line " + (idx + 1)} placeholder="Account Code" value={line.accountCode} onChange={e => {
                      const updated = [...newJournalLines];
                      updated[idx] = { ...updated[idx], accountCode: e.target.value };
                      setNewJournalLines(updated);
                    }} required />
                    <input aria-label={"Amount (Cents) for line " + (idx + 1)} type="number" placeholder="Amount (Cents)" value={line.amountCents} onChange={e => {
                      const updated = [...newJournalLines];
                      updated[idx] = { ...updated[idx], amountCents: Number(e.target.value) };
                      setNewJournalLines(updated);
                    }} required />
                    <select aria-label={"Transaction Type for line " + (idx + 1)} value={line.type} onChange={e => {
                      const updated = [...newJournalLines];
                      updated[idx] = { ...updated[idx], type: e.target.value as any };
                      setNewJournalLines(updated);
                    }}>
                      <option value="debit">DEBIT</option>
                      <option value="credit">CREDIT</option>
                    </select>
                    <input aria-label={"Memo for line " + (idx + 1)} placeholder="Memo" value={line.memo} onChange={e => {
                      const updated = [...newJournalLines];
                      updated[idx] = { ...updated[idx], memo: e.target.value };
                      setNewJournalLines(updated);
                    }} />
                    {newJournalLines.length > 2 && (
                      <button type="button" className="btn btn-danger" aria-label="Remove line" title="Remove line" onClick={() => setNewJournalLines(prev => prev.filter((_, i) => i !== idx))} style={{ height: '42px', padding: '0 1rem' }}>
                        &times;
                      </button>
                    )}
                  </div>
                ))}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
                  {loading ? <Spinner /> : null} Post Balanced Journal Entry
                </button>
              </form>
            </div>

            <div className="glass-panel">
              <h2 className="form-section-title">General Ledger Entries</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {journals.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No accounting entries posted for this tenant.</p> : journals.map(entry => (
                  <div key={entry.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem', background: 'rgba(0,0,0,0.1)' }}>
                    <div className="flex-between">
                      <strong>{entry.description}</strong>
                      <span className="badge badge-success">{entry.method}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0' }}>
                      Date: {new Date(entry.date).toLocaleDateString()} | Reference: {entry.referenceId || 'N/A'}
                    </div>
                    
                    <div style={{ marginTop: '0.75rem' }}>
                      {entry.lines.map((l, lIdx) => (
                        <div key={lIdx} className="flex-between" style={{ fontSize: '0.85rem', padding: '0.25rem 0', borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                          <span style={{ paddingLeft: l.type === 'credit' ? '1.5rem' : '0' }}>
                            {l.accountCode} {l.memo && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({l.memo})</span>}
                          </span>
                          <span style={{ fontFamily: 'monospace' }}>
                            {l.type === 'debit' ? `$${(l.amountCents / 100).toFixed(2)}` : `($${(l.amountCents / 100).toFixed(2)})`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 6. Serial tracking tab */}
        {activeTab === 'serials' && (
          <div className="grid-cols-2">
            <div className="glass-panel" style={{ alignSelf: 'start' }}>
              <h2 className="form-section-title">Trace Serialized Item</h2>
              <form onSubmit={handleTraceSerial}>
                <div className="form-group">
                  <label htmlFor="traceSerialNum">Enter Serial Number</label>
                  <input id="traceSerialNum" autoFocus value={traceSerialNum} onChange={e => setTraceSerialNum(e.target.value)} placeholder="e.g. SN123" required />
                </div>
                <button type="submit" className={"btn btn-primary" + (loading ? " btn-loading" : "")} style={{ width: '100%' }} disabled={loading}>
                  Trace History Timeline
                </button>
              </form>
            </div>

            {tracedItem ? (
              <div className="glass-panel">
                <h2 className="form-section-title">Trace Details: {tracedItem.serialNumber}</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                  <div>
                    <label>Variant ID</label>
                    <strong>{tracedItem.variantId}</strong>
                  </div>
                  <div>
                    <label>Location</label>
                    <span className="badge badge-info">{tracedItem.locationId}</span>
                  </div>
                  <div>
                    <label>Current Status</label>
                    <span className="badge badge-success">{tracedItem.status}</span>
                  </div>
                </div>

                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Status Transition Timeline</h3>
                <div className="timeline">
                  {tracedItem.history.map((h, idx) => (
                    <div key={idx} className="timeline-item success">
                      <div className="timeline-header">
                        <span>Status: {h.from} → {h.to}</span>
                        <span>{new Date(h.occurredAt).toLocaleString()}</span>
                      </div>
                      <div className="timeline-body">
                        Reason: {h.reason || 'None provided'} <br />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Actor: {h.actor} | Reference: {h.referenceId || 'N/A'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="glass-panel flex-center" style={{ height: '200px', color: 'var(--text-muted)' }}>
                Search for an active serial number (e.g., SN123) to view current status and trace its transition history.
              </div>
            )}
          </div>
        )}

        {/* 7. Shopify Integrations tab */}
        {activeTab === 'shopify' && (
          <div className="grid-cols-2">
            <div className="glass-panel" style={{ alignSelf: 'start' }}>
              <h2 className="form-section-title">Connect Shopify Store</h2>
              <form onSubmit={handleConnectShopify}>
                <div className="form-group">
                  <label htmlFor="newShopifyId">Connection ID (UUID recommended)</label>
                  <input id="newShopifyId" value={newShopifyId} onChange={e => setNewShopifyId(e.target.value)} placeholder="e.g. conn-abc" required />
                </div>
                <div className="form-group">
                  <label htmlFor="newShopifyDomain">Shopify Store Domain</label>
                  <input id="newShopifyDomain" value={newShopifyDomain} onChange={e => setNewShopifyDomain(e.target.value)} placeholder="e.g. customtee.myshopify.com" required />
                </div>
                <div className="form-group">
                  <label htmlFor="newShopifyToken">Access Token</label>
                  <input id="newShopifyToken" type="password" value={newShopifyToken} onChange={e => setNewShopifyToken(e.target.value)} placeholder="shpat_..." required />
                </div>
                <button type="submit" className={"btn btn-primary" + (loading ? " btn-loading" : "")} style={{ width: '100%' }} disabled={loading}>
                  Connect Store Domain
                </button>
              </form>
            </div>

            <div className="glass-panel">
              <h2 className="form-section-title">Platform Connections</h2>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>Store Domain</th>
                      <th>Integration Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shopifyConns.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No platforms connected.</td>
                      </tr>
                    ) : shopifyConns.map(c => (
                      <tr key={c.id}>
                        <td><strong>{c.platform.toUpperCase()}</strong></td>
                        <td>{c.storeDomain}</td>
                        <td>
                          <span className={`badge ${c.isActive ? 'badge-success' : 'badge-error'}`}>
                            {c.isActive ? 'Active Syncing' : 'Disabled'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

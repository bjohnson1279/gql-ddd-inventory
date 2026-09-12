// --- Omnichannel Integration Types (Shared) ---

export interface ExternalMapping {
  id: string;
  externalId: string;
  internalId: string;
  entityType: 'Location' | 'Variant';
}

export interface WebhookSubscription {
  id: string;
  tenantId: string;
  url: string;
  eventTypes: string[];
}

// --- Core Channel Types ---
export interface ChannelAllocation {
  id: string;
  channelId: string;
  variantId: string;
  allocatedQuantity: number;
}

export interface BaseChannelConnection {
  id: string;
  tenantId: string;
  channelType: 'shopify' | 'amazon' | 'woocommerce' | 'csv_edi';
  mapping?: ExternalMapping[];
}

export interface ShopifyConnection extends BaseChannelConnection {
  channelType: 'shopify';
  domain: string;
  token: string;
  webhookUrl?: string;
}

export interface AmazonConnection extends BaseChannelConnection {
  channelType: 'amazon';
  sellerId: string;
  mwsAuthToken: string;
  marketplaceId: string;
}

export interface WooCommerceConnection extends BaseChannelConnection {
  channelType: 'woocommerce';
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface CsvEdiConnection extends BaseChannelConnection {
  channelType: 'csv_edi';
  ftpHost?: string;
  ftpUser?: string;
  ftpPassword?: string;
  mappingFormat: string; // e.g., 'X12_850' or 'CUSTOM_CSV'
}

/**
 * BaseChannelAdapter implements the channel adapter contract.
 */
export interface BaseChannelAdapter<T extends BaseChannelConnection> {
  connect(connectionParams: Omit<T, 'id' | 'tenantId' | 'channelType'>): void;
  disconnect(): void;
  getConnections(tenantId: string): Promise<T[]>;
  createConnection(tenantId: string, params: Omit<T, 'id' | 'tenantId' | 'channelType'>): Promise<void>;
  
  syncInventory(connectionId: string, onSyncProgress?: (progress: number) => void): Promise<void>;
  ingestOrder(orderData: any, mapping?: ExternalMapping): any;
  pushFulfillmentStatus(orderId: string, status: 'pending' | 'shipped' | 'delivered'): Promise<void>;
  
  subscribeEvents(tenantId: string, webhookUrl?: string): () => void;
}
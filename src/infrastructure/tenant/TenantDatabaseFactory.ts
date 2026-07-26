import { PrismaClient } from '@prisma/client';

export interface TenantConfig {
  tenantId: string;
  databaseUrl: string;
  schema?: string;
}

export class TenantDatabaseFactory {
  private static instance: TenantDatabaseFactory;
  private clientPool: Map<string, PrismaClient> = new Map();
  private tenantConfigs: Map<string, TenantConfig> = new Map();

  private constructor() {}

  public static getInstance(): TenantDatabaseFactory {
    if (!TenantDatabaseFactory.instance) {
      TenantDatabaseFactory.instance = new TenantDatabaseFactory();
    }
    return TenantDatabaseFactory.instance;
  }

  public registerTenant(config: TenantConfig): void {
    this.tenantConfigs.set(config.tenantId, config);
  }

  public getClient(tenantId: string): PrismaClient {
    if (this.clientPool.has(tenantId)) {
      return this.clientPool.get(tenantId)!;
    }

    const config = this.tenantConfigs.get(tenantId);
    let dbUrl = process.env.DATABASE_URL;

    if (config) {
      dbUrl = config.databaseUrl;
      if (config.schema) {
        try {
          const urlObj = new URL(config.databaseUrl);
          urlObj.searchParams.set('schema', config.schema);
          dbUrl = urlObj.toString();
        } catch {
          dbUrl = config.databaseUrl;
        }
      }
    }

    // Provision new PrismaClient bound to tenant database URL / schema
    const client = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    });

    this.clientPool.set(tenantId, client);
    return client;
  }

  public async disconnectAll(): Promise<void> {
    for (const [, client] of this.clientPool.entries()) {
      await client.$disconnect();
    }
    this.clientPool.clear();
  }
}

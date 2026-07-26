import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { parse } from 'graphql';
import { resolvers } from '../../infrastructure/graphql/resolvers';
import { globalPrisma, getTenantPrisma } from '../../infrastructure/persistence/prismaClient';
import { createDataLoaders } from '../../infrastructure/graphql/dataloaders';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dummy_jwt_secret';

const typeDefs = parse(`
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0",
          import: ["@key", "@external", "@requires", "@provides"])

  enum AccountingMethod {
    cash
    accrual
  }

  enum CostingMethod {
    fifo
    lifo
    weighted_average_cost
    specific_identification
    fefo
  }

  enum DebitCredit {
    debit
    credit
  }

  type TenantAccountingConfig {
    tenantId: ID!
    accountingMethod: AccountingMethod!
    costingMethod: CostingMethod!
  }

  type StockValuationLineItem {
    sku: String!
    variantId: ID!
    locationId: String!
    quantityOnHand: Int!
    unitCostCents: Int!
    totalValueCents: Int!
    costingMethod: String!
  }

  type StockValuationReport {
    tenantId: ID!
    locationId: String
    method: CostingMethod!
    generatedAt: String!
    totalValueCents: Int!
    lineItems: [StockValuationLineItem!]!
  }

  type JournalLine {
    id: ID!
    accountCode: String!
    accountName: String!
    accountCategory: String!
    debitOrCredit: DebitCredit!
    amountCents: Int!
    memo: String
  }

  type JournalEntry {
    id: ID!
    tenantId: ID!
    entryDate: String!
    description: String!
    referenceId: String
    accountingMethod: AccountingMethod!
    lines: [JournalLine!]!
  }

  type NetsuiteJournalMapping {
    id: ID!
    journalEntryId: String!
    netsuiteJournalId: String!
    createdAt: String!
  }

  type XeroJournalMapping {
    id: ID!
    journalEntryId: String!
    xeroJournalId: String!
    createdAt: String!
  }

  type QuickbooksJournalMapping {
    id: ID!
    journalEntryId: String!
    quickbooksJournalId: String!
    createdAt: String!
  }

  type ProductVariant @key(fields: "id") {
    id: ID! @external
  }

  input JournalLineInput {
    accountCode: String!
    accountName: String!
    accountCategory: String!
    debitOrCredit: DebitCredit!
    amountCents: Int!
    memo: String
  }

  input CreateJournalEntryInput {
    entryDate: String!
    description: String!
    referenceId: String
    lines: [JournalLineInput!]!
  }

  input SaveTenantAccountingConfigInput {
    tenantId: ID!
    accountingMethod: AccountingMethod!
    costingMethod: CostingMethod!
  }

  type Query {
    journalEntries: [JournalEntry!]!
    journalEntry(id: ID!): JournalEntry
    accountingConfig: TenantAccountingConfig
    stockValuationReport(locationId: String): StockValuationReport!
    netsuiteJournalMapping(journalEntryId: String!): NetsuiteJournalMapping
    xeroJournalMapping(journalEntryId: String!): XeroJournalMapping
    quickbooksJournalMapping(journalEntryId: String!): QuickbooksJournalMapping
  }

  type Mutation {
    createJournalEntry(input: CreateJournalEntryInput!): Boolean!
    saveTenantAccountingConfig(input: SaveTenantAccountingConfigInput!): Boolean!
    syncJournalToNetSuite(journalEntryId: String!): Boolean!
    syncJournalToXero(journalEntryId: String!): Boolean!
    syncJournalToQuickBooks(journalEntryId: String!): Boolean!
  }
`);

const server = new ApolloServer({
  schema: buildSubgraphSchema({ typeDefs, resolvers: resolvers as any }),
});

async function start() {
  const PORT = parseInt(process.env.PORT || '4003', 10);
  const { url } = await startStandaloneServer(server, {
    listen: { port: PORT },
    context: async ({ req }) => {
      const authHeader = req.headers.authorization || req.headers.Authorization || '';
      let auth: any = undefined;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          auth = jwt.verify(token, JWT_SECRET) as any;
        } catch (err) {}
      }
      const tenantId = auth?.tenantId;
      const activePrisma = tenantId ? getTenantPrisma(globalPrisma, tenantId) : globalPrisma;
      return {
        auth,
        prisma: activePrisma,
        loaders: createDataLoaders(activePrisma),
      };
    },
  });
  console.log(`🚀 Accounting Subgraph ready at ${url}`);
}

start().catch(console.error);

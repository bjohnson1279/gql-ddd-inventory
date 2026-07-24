import { ApolloServer } from '@apollo/server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { parse } from 'graphql';

export const inventoryTypeDefs = parse(`#graphql
  type StockLevel @key(fields: "id") {
    id: ID!
    sku: String!
    quantity: Int!
    warehouseId: String!
    binLocation: String
  }

  type Query {
    stockLevels: [StockLevel!]!
    stockLevel(id: ID!): StockLevel
  }
`);

export const inventoryResolvers = {
  Query: {
    stockLevels: () => [
      { id: 'stk-1', sku: 'SKU-ELEC-001', quantity: 150, warehouseId: 'wh-main', binLocation: 'A1-B2' },
      { id: 'stk-2', sku: 'SKU-MECH-002', quantity: 45, warehouseId: 'wh-north', binLocation: 'C3-D4' },
    ],
    stockLevel: (_: any, args: { id: string }) => ({
      id: args.id,
      sku: 'SKU-ELEC-001',
      quantity: 150,
      warehouseId: 'wh-main',
      binLocation: 'A1-B2',
    }),
  },
  StockLevel: {
    __resolveReference(reference: { id: string }) {
      return { id: reference.id, sku: 'SKU-ELEC-001', quantity: 150, warehouseId: 'wh-main', binLocation: 'A1-B2' };
    },
  },
};

export function createInventorySubgraphServer() {
  return new ApolloServer({
    schema: buildSubgraphSchema({ typeDefs: inventoryTypeDefs, resolvers: inventoryResolvers }),
  });
}

import { ApolloServer } from '@apollo/server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { parse } from 'graphql';

export const catalogTypeDefs = parse(`#graphql
  type Product @key(fields: "id") {
    id: ID!
    sku: String!
    name: String!
    category: String!
    unitPrice: Float!
  }

  type Query {
    products: [Product!]!
    product(id: ID!): Product
  }
`);

export const catalogResolvers = {
  Query: {
    products: () => [
      { id: 'prod-1', sku: 'SKU-ELEC-001', name: 'Microcontroller Board v2', category: 'Electronics', unitPrice: 29.99 },
      { id: 'prod-2', sku: 'SKU-MECH-002', name: 'Industrial Servo Motor', category: 'Machinery', unitPrice: 189.50 },
    ],
    product: (_: any, args: { id: string }) => ({
      id: args.id,
      sku: 'SKU-ELEC-001',
      name: 'Microcontroller Board v2',
      category: 'Electronics',
      unitPrice: 29.99,
    }),
  },
  Product: {
    __resolveReference(reference: { id: string }) {
      return { id: reference.id, sku: 'SKU-ELEC-001', name: 'Microcontroller Board v2', category: 'Electronics', unitPrice: 29.99 };
    },
  },
};

export function createCatalogSubgraphServer() {
  return new ApolloServer({
    schema: buildSubgraphSchema({ typeDefs: catalogTypeDefs, resolvers: catalogResolvers }),
    formatError: (formattedError: any) => {
      if (process.env.NODE_ENV === 'production') {
        if (formattedError.extensions) {
          if (formattedError.extensions.exception) {
            delete formattedError.extensions.exception;
          }
          delete formattedError.extensions.stacktrace;
        }
        return formattedError;
      }
      if (formattedError.extensions) {
        if (formattedError.extensions.exception) {
          delete formattedError.extensions.exception.stacktrace;
        }
        delete formattedError.extensions.stacktrace;
      }
      return formattedError;
    },
  });
}

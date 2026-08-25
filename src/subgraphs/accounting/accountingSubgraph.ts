import { ApolloServer } from '@apollo/server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { parse } from 'graphql';

export const accountingTypeDefs = parse(`#graphql
  type InventoryValuation @key(fields: "id") {
    id: ID!
    totalValuation: Float!
    costingMethod: String!
    currency: String!
  }

  type Query {
    valuations: [InventoryValuation!]!
  }
`);

export const accountingResolvers = {
  Query: {
    valuations: () => [
      { id: 'val-1', totalValuation: 458900.50, costingMethod: 'FIFO', currency: 'USD' },
      { id: 'val-2', totalValuation: 124500.00, costingMethod: 'WAC', currency: 'USD' },
    ],
  },
  InventoryValuation: {
    __resolveReference(reference: { id: string }) {
      return { id: reference.id, totalValuation: 458900.50, costingMethod: 'FIFO', currency: 'USD' };
    },
  },
};

export function createAccountingSubgraphServer() {
  return new ApolloServer({
    schema: buildSubgraphSchema({ typeDefs: accountingTypeDefs, resolvers: accountingResolvers }),
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

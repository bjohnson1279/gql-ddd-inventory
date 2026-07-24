import { ApolloServer } from '@apollo/server';
import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway';

export function createFederatedGateway(subgraphUrls: { name: string; url: string }[]) {
  const gateway = new ApolloGateway({
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: subgraphUrls,
    }),
  });

  return new ApolloServer({
    gateway,
  });
}

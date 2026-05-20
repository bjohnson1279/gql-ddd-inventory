import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './infrastructure/graphql/typeDefs';
import { resolvers } from './infrastructure/graphql/resolvers';

async function startApolloServer() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
  });

  console.log(`🚀  Inventory API Server ready at: ${url}`);
}

startApolloServer().catch(err => {
  console.error("Failed to start server:", err);
});

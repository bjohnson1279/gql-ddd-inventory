import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './infrastructure/graphql/typeDefs';
import { resolvers } from './infrastructure/graphql/resolvers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-999';

async function startApolloServer() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
    context: async ({ req }) => {
      const authHeader = req.headers.authorization || '';
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          return { auth: decoded };
        } catch (err) {
          // Token invalid or expired
        }
      }
      return {};
    }
  });

  console.log(`🚀  Inventory API Server ready at: ${url}`);
}

startApolloServer().catch(err => {
  console.error("Failed to start server:", err);
});

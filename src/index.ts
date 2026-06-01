import { createServer } from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import jwt from 'jsonwebtoken';

import { typeDefs } from './infrastructure/graphql/typeDefs';
import { resolvers } from './infrastructure/graphql/resolvers';
import { shopifyWebhookHandler } from './infrastructure/webhooks/shopifyWebhookHandler';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL ERROR: JWT_SECRET environment variable is not set.');
}

async function startApolloServer() {
  const app = express();
  const httpServer = createServer(app);

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // Set up WebSocket server
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  // Integrate WebSocket server with graphql-ws
  const serverCleanup = useServer(
    {
      schema,
      // Inject auth context into subscription connections
      context: async (ctx: any) => {
        // Connection params carry the Authorization header during WebSockets handshakes
        const connectionParams = ctx.connectionParams || {};
        const authHeader = connectionParams.Authorization || connectionParams.authorization || '';
        if (authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = jwt.verify(token, JWT_SECRET as string);
            return { auth: decoded };
          } catch (err) {
            // Invalid token
          }
        }
        return {};
      },
    },
    wsServer
  );

  // Set up Apollo Server
  const server = new ApolloServer({
    schema,
    plugins: [
      // Proper shutdown for the HTTP server
      ApolloServerPluginDrainHttpServer({ httpServer }),
      // Proper shutdown for the WebSocket server
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();

  // Shopify Webhook Endpoint (verifies HMAC and dispatches corresponding use cases)
  app.post('/webhooks/shopify', express.raw({ type: 'application/json' }), shopifyWebhookHandler);

  // Mount Apollo express middleware
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
  app.use(
    '/graphql',
    cors<cors.CorsRequest>({
      origin: (origin, callback) => {
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
          const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
          return callback(new Error(msg), false);
        }
        return callback(null, true);
      }
    }),
    bodyParser.json(),
    expressMiddleware(server, {
      context: async ({ req }: { req: express.Request }) => {
        const authHeader = req.headers.authorization || '';
        if (authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = jwt.verify(token, JWT_SECRET as string);
            return { auth: decoded };
          } catch (err) {
            // Invalid token or expired
          }
        }
        return {};
      },
    })
  );

  const PORT = 4000;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    console.log(`🚀 Subscriptions ready at ws://localhost:${PORT}/graphql`);
  });
}

startApolloServer().catch(err => {
  console.error("Failed to start server:", err);
});

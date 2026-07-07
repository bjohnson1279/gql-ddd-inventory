import { createServer } from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import bodyParser from 'body-parser';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import jwt from 'jsonwebtoken';

import { typeDefs } from './infrastructure/graphql/typeDefs';
import { resolvers } from './infrastructure/graphql/resolvers';
import { shopifyWebhookHandler } from './infrastructure/webhooks/shopifyWebhookHandler';
import { createDataLoaders } from './infrastructure/graphql/dataloaders';
import { depthLimitRule, complexityLimitRule } from './infrastructure/graphql/guardrails';
import { prisma, prismaContext, getTenantPrisma, globalPrisma } from './infrastructure/persistence/prismaClient';
import { enableRowLevelSecurity } from './infrastructure/persistence/rls';
import { WebhookWorker } from './infrastructure/workers/WebhookWorker';
import { OutboxWorker } from './infrastructure/workers/OutboxWorker';
import { AuditWorker } from './infrastructure/workers/AuditWorker';

// Security fix: Enforce JWT_SECRET in production to prevent hardcoded fallback vulnerabilities.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL ERROR: JWT_SECRET environment variable is not set.');
}

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;
if (!SHOPIFY_WEBHOOK_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL ERROR: SHOPIFY_WEBHOOK_SECRET environment variable is not set.');
}

function setupWebSocketServer(httpServer: any, schema: any) {
  // Set up WebSocket server
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  // Integrate WebSocket server with graphql-ws
  return useServer(
    {
      schema,
      // Inject auth context into subscription connections
      context: async (ctx: any) => {
        // Connection params carry the Authorization header during WebSockets handshakes
        const connectionParams = ctx.connectionParams || {};
        const authHeader = connectionParams.Authorization || connectionParams.authorization || '';
        let auth: any = undefined;
        if (authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            auth = jwt.verify(token, JWT_SECRET as string);
          } catch (err) {
            // Invalid token
          }
        }
        const activePrisma = auth?.tenantId ? getTenantPrisma(globalPrisma, auth.tenantId) : globalPrisma;
        return {
          auth,
          prisma: activePrisma,
          loaders: createDataLoaders(activePrisma),
        };
      },
    },
    wsServer
  );
}

async function setupApolloServer(schema: any, httpServer: any, serverCleanup: any) {
  // Set up Apollo Server
  const server = new ApolloServer({
    schema,
    formatError: (formattedError: any) => {
      // Security fix: Strip stack traces from error responses to prevent information leakage
      if (formattedError.extensions) {
        if (formattedError.extensions.exception) {
          delete formattedError.extensions.exception.stacktrace;
        }
        delete formattedError.extensions.stacktrace;
      }
      return formattedError;
    },
    validationRules: [
      depthLimitRule(5),
      complexityLimitRule(100)
    ],
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
  return server;
}

import { traceMiddleware } from './infrastructure/http/middleware/traceMiddleware';

function applyExpressMiddleware(app: express.Express, server: ApolloServer) {
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 1000, // Limit each IP to 1000 requests per window (here, per 15 minutes).
    standardHeaders: 'draft-7', // draft-6: RateLimit-* headers; draft-7: combined RateLimit header
    legacyHeaders: false, // Disable the X-RateLimit-* headers.
    message: 'Too many requests from this IP, please try again after 15 minutes'
  });

  // Shopify Webhook Endpoint (verifies HMAC and dispatches corresponding use cases)
  app.post('/webhooks/shopify', express.raw({ type: 'application/json' }), shopifyWebhookHandler);

  // Mount Apollo express middleware
  // Security fix: Securely parse allowed origins from environment variable to prevent overly permissive CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : [];
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    })
  );
  app.use(
    /^\/graphql/, // Apply traceMiddleware early for all graphql traffic
    traceMiddleware
  );
  app.use(
    '/graphql',
    apiLimiter,
    // Apply parsed allowed origins to securely restrict CORS
    cors<cors.CorsRequest>({
      origin: allowedOrigins
    }),
    bodyParser.json(),
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const authHeader = req.headers.authorization || req.headers.Authorization || '';
      let tenantId: string | undefined;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = jwt.verify(token, JWT_SECRET as string) as any;
          tenantId = decoded.tenantId;
        } catch (err) {}
      }
      const activePrisma = tenantId ? getTenantPrisma(globalPrisma, tenantId) : globalPrisma;
      prismaContext.run(activePrisma, () => {
        next();
      });
    },
    expressMiddleware(server, {
      context: async ({ req }: { req: express.Request }) => {
        const authHeader = req.headers.authorization || req.headers.Authorization || '';
        let auth: any = undefined;
        if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            auth = jwt.verify(token, JWT_SECRET as string);
          } catch (err) {
            // Invalid token or expired
          }
        }
        const db = prismaContext.getStore() || globalPrisma;
        return {
          auth,
          prisma: db,
          loaders: createDataLoaders(db),
        };
      },
    })
  );
}

async function startApolloServer() {
  // Set up Row-Level Security policies on startup
  try {
    await enableRowLevelSecurity(globalPrisma);
  } catch (err: any) {
    console.log("Database/RLS setup warning:", err.message);
  }

  const app = express();
  const httpServer = createServer(app);

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const serverCleanup = setupWebSocketServer(httpServer, schema);

  const server = await setupApolloServer(schema, httpServer, serverCleanup);

  applyExpressMiddleware(app, server);

  const PORT = 4000;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    console.log(`🚀 Subscriptions ready at ws://localhost:${PORT}/graphql`);

    if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_WORKERS !== 'true') {
      WebhookWorker.start();
      OutboxWorker.start();
      AuditWorker.start();
    }
  });
}

startApolloServer().catch(err => {
  console.error("Failed to start server:", err);
});

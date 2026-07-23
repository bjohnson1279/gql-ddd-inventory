import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import { expressMiddleware } from '@as-integrations/express5';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import helmet from 'helmet';

// Gateway routes requests to subgraphs and propagates Authorization header
class AuthenticatedDataSource extends RemoteGraphQLDataSource {
  willSendRequest({ request, context }: any) {
    if (context.authHeader) {
      request.http.headers.set('Authorization', context.authHeader);
    }
  }
}

async function startGateway() {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : [];

  const subgraphs = [
    { name: 'inventory', url: process.env.INVENTORY_SUBGRAPH_URL || 'http://localhost:4001/graphql' },
    { name: 'catalog', url: process.env.CATALOG_SUBGRAPH_URL || 'http://localhost:4002/graphql' },
    { name: 'accounting', url: process.env.ACCOUNTING_SUBGRAPH_URL || 'http://localhost:4003/graphql' },
  ];

  let gateway: ApolloGateway | null = null;
  let retries = 10;

  while (retries > 0) {
    try {
      console.log(`[Gateway] Composition attempt... (${retries} retries left)`);
      gateway = new ApolloGateway({
        supergraphSdl: new IntrospectAndCompose({
          subgraphs,
        }),
        buildService({ url }) {
          return new AuthenticatedDataSource({ url });
        },
      });

      // Simple test schema composition to trigger introspect
      await gateway.load();
      console.log('[Gateway] Schema composition succeeded!');
      break;
    } catch (err: any) {
      console.error('[Gateway] Introspection composition failed, retrying in 5 seconds...', err.message);
      retries--;
      if (retries === 0) {
        console.error('[Gateway] Fatal: Subgraphs did not start up in time. Exiting.');
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  const app = express();
  const httpServer = createServer(app);

  const server = new ApolloServer({
    gateway: gateway!,
    formatError: (formattedError: any) => {
      if (formattedError.extensions) {
        if (formattedError.extensions.exception) {
          delete formattedError.extensions.exception.stacktrace;
        }
        delete formattedError.extensions.stacktrace;
      }
      return formattedError;
    },
  });

  await server.start();

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    })
  );

  app.use(
    '/graphql',
    cors<cors.CorsRequest>({
      origin: allowedOrigins,
    }),
    bodyParser.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        return {
          authHeader: req.headers.authorization || req.headers.Authorization || '',
        };
      },
    })
  );

  const PORT = parseInt(process.env.PORT || '4000', 10);
  httpServer.listen(PORT, () => {
    console.log(`🚀 Gateway ready at http://localhost:${PORT}/graphql`);
  });
}

startGateway().catch(console.error);

# gql-ddd-inventory Copilot Instructions

This repository is a TypeScript-based inventory application built around GraphQL and Domain-Driven Design (DDD).

## Important context

- Stack: `TypeScript`, `GraphQL`, `Apollo Server`, `Express`, `React` frontend
- Backend and domain logic live in `src/`
- Frontend dashboard lives in `web/`
- Database schema and Prisma client are in `prisma/`
- Design documentation is in `plan/`

## Key behaviors

- Uses GraphQL for queries, mutations, and subscriptions
- Supports JWT authentication and role-based access rules
- Integrates with Redis pub/sub for subscription events
- Uses Prisma for database modeling and migrations
- Backend development command is `npm run dev`

## Common repo tasks

### Install and setup
```bash
cd gql-ddd-inventory
npm install
npx prisma generate
npx prisma db push
```

### Run backend
```bash
npm run dev
```

### Run frontend
```bash
cd web
npm install
npm run dev
```

### Run tests
```bash
npm test
```

## Guidance for Copilot edits

- Preserve the separation between backend server code and the React web client.
- If a change affects database schema or Prisma models, verify `prisma/schema.prisma` and regenerate the client.
- If updating GraphQL schema/resolvers, also update any client-side query usage in `web/src/`.
- Avoid introducing cross-repo dependencies; this repo should remain standalone.

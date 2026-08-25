# GraphQL Microservice Architecture & Layer Isolation

## Layer Boundaries
1. **Domain Layer (`src/domain/`)**: Core domain models (Shipping, ERP, Ingestion) and business logic. Independent of GraphQL schemas.
2. **Application Layer (`src/application/`)**: Application services for bulk scan ingestion, inventory rebalancing, and logistics calculations.
3. **Infrastructure Layer (`src/infrastructure/`)**: GraphQL resolvers, database client bindings, and cryptographic security utilities.

## Automated Refactoring Rules
- **GraphQL Resolver Optimization**: Avoid N+1 query patterns in field resolvers; pre-fetch entities using batch methods or `DataLoader`.
- **Cryptographic Randomness**: Replace `Math.random()` with `crypto.randomInt()` for generating tracking numbers, BOL IDs, and mock transaction hashes.
- **Test-Pairing Mandatory Directive**: Every GraphQL resolver change or security refactor MUST include a corresponding Jest test in `tests/`.

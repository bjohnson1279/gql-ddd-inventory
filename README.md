# GraphQL DDD Inventory System

A production-ready, multi-tenant inventory control system built in TypeScript utilizing **Domain-Driven Design (DDD)** principles. The application exposes a unified GraphQL API with queries, mutations, and real-time subscription capabilities.

---

## 🏗️ Bounded Contexts & Specs

The system is split into distinct domain-driven bounded contexts. Technical specs for each module can be reviewed in the `plan/` directory:

*   **Stock Onboarding**: [opening-balance-ddd.md](plan/opening-balance-ddd.md) — Opening balances, batch sheets, and ledger onboarding state-machines.
*   **SKU Variance & Kitting**: [sku-variance-kitting-ddd.md](plan/sku-variance-kitting-ddd.md) — Item variants, bundle assemblies, and Component BOM deductions.
*   **Unit of Measure (UOM)**: [uom-conversions-ddd.md](plan/uom-conversions-ddd.md) — Conversions between continuous/discrete purchasing and sale units.
*   **Serial Number Tracking**: [serial-number-tracking-ddd.md](plan/serial-number-tracking-ddd.md) — Lifecycle tracking of serialized components (InStock, Dispatched, Quarantined, Returned).
*   **Accrual & Cash Accounting**: [accounting-methods-ddd.md](plan/accounting-methods-ddd.md) — cost layers (FIFO/LIFO) depletion and general ledger journal postings.
*   **Barcode Modeling**: [barcode-modeling-ddd.md](plan/barcode-modeling-ddd.md) — validation patterns and real-time scanning event dispatcher pipelines.

---

## 🛠️ Prerequisites

*   **Node.js**: `v20.x` or later
*   **Docker & Docker Compose** (for persistent containerization)
*   **PostgreSQL 15 with TimescaleDB Extension** (local instance or Docker container)

---

## 🚀 Getting Started (Local Development)

### 1. Environment Configurations
Create a `.env` file in the project root:
```env
PORT=4000
DATABASE_URL="postgresql://inventory_user:inventory_password@localhost:5433/inventory_db?schema=public"
JWT_SECRET="your-secure-random-secret"
```

### 2. Install Dependencies & Generate Prisma Client
Install packages and sync database schema maps:
```bash
# Install dependencies
pnpm install

# Generate Prisma Client classes
pnpm exec prisma generate

# Sync schema to target Postgres instance
pnpm exec prisma db push
```
*(The schema definitions are stored in [schema.prisma](prisma/schema.prisma))*

### 3. Run Server
Boot the GraphQL API server:
```bash
# Run Backend GraphQL Server (in project root)
pnpm run dev
```
The GraphQL server will boot at `http://localhost:4000/graphql`.

---

## 🐳 Containerized Operations (Production-Ready)

You can run the entire environment (API backend, React frontend on Nginx, Postgres, and the DB Backup helper) using Docker Compose:
```bash
# Launch all services
docker compose up -d --build
```
Refer to the [docker-compose.yml](docker-compose.yml) configuration for service port mappings (`5433` for DB, `4000` for GraphQL API). The database service runs the TimescaleDB image (`timescale/timescaledb:latest-pg15`), converting `ledger_entries` into a hypertable partitioned by `occurred_at`.

---

## 🔐 Role-Based Access Control (RBAC)

The GraphQL API is authenticated using JSON Web Tokens (JWT) and authorization rules mapped within the resolvers ([resolvers.ts](src/infrastructure/graphql/resolvers.ts)).

### Supported Roles
1.  **Admin (`admin`)**: Access to all operations, catalog mutations, and Shopify credentials setup.
2.  **Warehouse Operator (`warehouse_operator`)**: Access to scanning simulator, barcode assignment, kit assembly/disassembly, and serial status transitions. Restricted from viewing general ledger journals.
3.  **Accountant (`accountant`)**: Access to opening balance onboarding sheets, General Ledger journal postings, and cost layer logs. Restricted from catalog creation, scan dispatcher, and shopify connection endpoints.
4.  **Viewer (`viewer`)**: Read-only access to dashboard statistics, products catalog, and serial transition history. Restricts all write/mutation actions.

### Authenticating Queries
Perform a login mutation to retrieve a token:
```graphql
mutation Login {
  login(tenantId: "tenant-1", actorId: "operator-user", role: "warehouse_operator")
}
```
Include the return string as a `Bearer` token inside the `Authorization` request header:
```http
Authorization: Bearer <your_jwt_token>
```

---

## 🔮 Backup and Recovery Operations

Automated database snapshots are scheduled daily using a dedicated cron container. Manual script helpers are provided inside `infra/db/`:

*   **Automated Backup**: Saved in compressed format (`.sql.gz`) in host folder `./infra/db/backups`.
*   **Manual Backup**:
    *   **Bash / macOS / Linux**: Run `./infra/db/backup.sh`
    *   **PowerShell / Windows**: Run `./infra/db/backup.ps1`
*   **Database Restore**:
    *   Restore database state from a compressed `.sql.gz` dump: Run `./infra/db/restore.sh <path_to_backup_file.sql.gz>`

---

## 🔌 Webhooks & Live Subscriptions

*   **Shopify Integration Webhooks**: The `/webhooks/shopify` POST endpoint processes HMAC-signed payloads from Shopify to sync inventory items and customer orders in real-time.
*   **Live Scanning Subscriptions**: The GraphQL engine hosts a WebSocket server under `ws://localhost:4000/graphql`. Clients can subscribe to `barcodeScanned(tenantId: ID!)` to stream physical scanner readings immediately onto dashboards.

---

## 🧪 Running Tests

### Unit & Integration Tests (Jest)
Runs the backend unit tests using mocked repositories:
```bash
pnpm test
```
All testing workflows, including database pushes and mock runs, are verified inside the [ci.yml](.github/workflows/ci.yml) GitHub Actions automation.

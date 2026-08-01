## 2025-02-24 - [SSRF Protection]
**Vulnerability:** User-provided webhook URLs were not validated for SSRF when creating or updating webhook subscriptions in `src/infrastructure/graphql/resolvers.ts`.
**Learning:** While the delivery worker (`WebhookDeliveryWorker.ts`) protected against SSRF by validating the URL at delivery time, the GraphQL resolvers lacked this validation, allowing users to configure malicious/invalid internal URLs (e.g. localhost) which could lead to SSRF vulnerabilities.
**Prevention:** Implement input validation for URLs directly in the GraphQL resolvers using the `validateOutboundUrl` utility to prevent malicious/invalid URLs from being stored in the database.

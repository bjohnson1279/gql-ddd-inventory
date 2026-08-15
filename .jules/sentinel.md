## 2025-02-23 - Missing JSON Body Parser Limit
**Vulnerability:** The Express application (`src/index.ts` and `src/gateway/index.ts`) used `bodyParser.json()` without specifying a maximum payload size.
**Learning:** By default, body-parser has a limit (usually 100kb), but leaving it implicit or unconfigured can leave the application vulnerable to Denial of Service (DoS) attacks if large JSON payloads are sent, consuming excessive memory and potentially crashing the Node.js process.
**Prevention:** Always configure an explicit, reasonable payload size limit (e.g., `bodyParser.json({ limit: '2mb' })`) to document the architectural boundary and prevent memory exhaustion attacks.

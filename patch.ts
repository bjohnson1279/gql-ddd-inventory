import fs from 'fs';
let content = fs.readFileSync('tests/infrastructure/persistence/TenantConnectionPool.test.ts', 'utf8');
content = content.replace(
  "dbName: 'inventory_db',",
  "dbName: 'inventory_db',\n        dbUser: 'user',\n        dbPassword: 'password',"
);
fs.writeFileSync('tests/infrastructure/persistence/TenantConnectionPool.test.ts', content);

const fs = require('fs');
let code = fs.readFileSync('tests/infrastructure/persistence/TenantRegistry.test.ts', 'utf8');

code = code.replace(/mockPrisma\.\$queryRawUnsafe\.mockResolvedValue/g, 'mockPrisma.$queryRaw.mockResolvedValue');
fs.writeFileSync('tests/infrastructure/persistence/TenantRegistry.test.ts', code);

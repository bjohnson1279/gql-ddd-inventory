const fs = require('fs');
let code = fs.readFileSync('tests/infrastructure/persistence/TenantRegistry.test.ts', 'utf8');

code = code.replace(/\$executeRawUnsafe: jest\.fn\(\)\.mockResolvedValue\(undefined\),/,
  '$executeRawUnsafe: jest.fn().mockResolvedValue(undefined),\n      $executeRaw: jest.fn().mockResolvedValue(undefined),');
code = code.replace(/\$queryRawUnsafe: jest\.fn\(\)\.mockResolvedValue\(\[\]\),/,
  '$queryRawUnsafe: jest.fn().mockResolvedValue([]),\n      $queryRaw: jest.fn().mockResolvedValue([]),');

code = code.replace(/expect\(mockPrisma\.\$executeRawUnsafe\)\.toHaveBeenCalledTimes\(1\);/,
  'expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);');
code = code.replace(/expect\(mockPrisma\.\$executeRawUnsafe\)\.toHaveBeenCalledWith\(\n        expect\.stringContaining\("INSERT INTO tenant_registry"\)\n      \);/,
  'expect(mockPrisma.$executeRaw).toHaveBeenCalledWith(expect.arrayContaining([expect.stringContaining("INSERT INTO tenant_registry")]), "acme-corp", expect.any(String), expect.any(Number), expect.any(String), expect.any(String), expect.any(String), "PROVISIONING", "0");');

code = code.replace(/mockPrisma\.\$queryRawUnsafe\.mockResolvedValue\(\[\{/g, 'mockPrisma.$queryRaw.mockResolvedValue([{');
code = code.replace(/mockPrisma\.\$queryRawUnsafe\.mockResolvedValue\(\[\]\);/g, 'mockPrisma.$queryRaw.mockResolvedValue([]);');

code = code.replace(/expect\(mockPrisma\.\$queryRawUnsafe\)\.toHaveBeenCalledWith\(\n        expect\.not\.stringContaining\("WHERE status"\)\n      \);/,
  'expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(expect.arrayContaining([expect.stringContaining("SELECT tenant_id")]), expect.objectContaining({ values: [] }));');

code = code.replace(/expect\(mockPrisma\.\$queryRawUnsafe\)\.toHaveBeenCalledWith\(\n        expect\.stringContaining\("WHERE status = 'ACTIVE'"\)\n      \);/,
  'expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(expect.arrayContaining([expect.stringContaining("SELECT tenant_id")]), expect.objectContaining({ values: ["ACTIVE"] }));');

code = code.replace(/expect\(mockPrisma\.\$executeRawUnsafe\)\.toHaveBeenCalledWith\(\n        expect\.stringContaining\("UPDATE tenant_registry SET status = 'ACTIVE'"\)\n      \);/,
  'expect(mockPrisma.$executeRaw).toHaveBeenCalledWith(expect.arrayContaining([expect.stringContaining("UPDATE tenant_registry SET status = ")]), "ACTIVE", "acme-corp");');

code = code.replace(/expect\(mockPrisma\.\$executeRawUnsafe\)\.toHaveBeenCalledWith\(\n        expect\.stringContaining\("DEPROVISIONED"\)\n      \);/,
  'expect(mockPrisma.$executeRaw).toHaveBeenCalledWith(expect.arrayContaining([expect.stringContaining("UPDATE tenant_registry SET status = ")]), "DEPROVISIONED", "acme-corp");');

fs.writeFileSync('tests/infrastructure/persistence/TenantRegistry.test.ts', code);

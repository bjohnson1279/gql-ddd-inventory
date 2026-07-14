import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const filePath = join(__dirname, 'tests/infrastructure/messaging/OutboxWorker.test.ts');
let content = readFileSync(filePath, 'utf-8');

content = content.replace(
  `  const txMock = {
    inventoryItem: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    outboxEvent: {
      create: createMock,
    },
  };`,
  `  const txMock = {
    inventoryItem: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    outboxEvent: {
      create: createMock,
      createMany: jest.fn(),
    },
  };

  (global as any).txMock = txMock;`
);

content = content.replace(
  `      outboxEvent: {
        create: createMock,
        findMany: jest.fn().mockResolvedValue([]),`,
  `      outboxEvent: {
        create: createMock,
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),`
);

content = content.replace(
  `    const outboxCreateMock = prisma.outboxEvent.create as jest.Mock;
    outboxCreateMock.mockClear();`,
  `    const txMock = (global as any).txMock;
    const outboxCreateManyMock = txMock.outboxEvent.createMany as jest.Mock;
    outboxCreateManyMock.mockClear();`
);

content = content.replace(
  `    expect(outboxCreateMock).toHaveBeenCalled();
    const arg = outboxCreateMock.mock.calls[0][0];
    expect(arg.data.eventType).toBe('InventoryReconciledEvent');
    expect(JSON.parse(arg.data.payload).sku).toBe('SKU-OUTBOX');`,
  `    expect(outboxCreateManyMock).toHaveBeenCalled();
    const arg = outboxCreateManyMock.mock.calls[0][0];
    expect(arg.data[0].eventType).toBe('InventoryReconciledEvent');
    expect(JSON.parse(arg.data[0].payload).sku).toBe('SKU-OUTBOX');`
);


writeFileSync(filePath, content);

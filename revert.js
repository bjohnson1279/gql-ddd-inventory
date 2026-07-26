const fs = require('fs');

const path = 'src/infrastructure/persistence/PostgresInventoryRepository.ts';
let code = fs.readFileSync(path, 'utf8');

const unoptimizedSaveBatch = `  async saveBatch(items: InventoryItem[]): Promise<void> {
    if (items.length === 0) return;

    const existingItems = await this.prisma.inventoryItem.findMany({
      where: {
        id: { in: items.map(i => i.id) }
      },
      select: { id: true }
    });

    const existingIds = new Set(existingItems.map(i => i.id));

    await this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of items) {
        let count = 0;
        if (!existingIds.has(item.id)) {
          await tx.inventoryItem.create({
            data: {
              id: item.id,
              sku: item.sku.value,
              locationId: item.locationId.value,
              quantity: item.quantity.value,
              allocated: item.allocated.value,
              inTransit: item.inTransit.value,
              version: item.version
            }
          });
          count = 1;
        } else {
          const updateResult = await tx.inventoryItem.updateMany({
            where: {
              id: item.id,
              version: item.version - 1
            },
            data: {
              quantity: item.quantity.value,
              allocated: item.allocated.value,
              inTransit: item.inTransit.value,
              version: item.version
            }
          });
          count = updateResult.count;
        }

        if (count === 0) {
          throw new ConcurrencyError(item.sku.value, item.locationId.value);
        }

        const events = item.pullDomainEvents();
        for (const event of events) {
          await tx.outboxEvent.create({
            data: {
              eventType: event.constructor.name,
              payload: JSON.stringify({
                ...event,
                traceId: (event as any).traceId || getTraceId()
              }),
              status: 'Pending'
            }
          });
        }
      }
    });
  }
}`;

code = code.replace(/  async saveBatch\(items: InventoryItem\[\]\): Promise<void> \{[\s\S]*\}\n\}/, unoptimizedSaveBatch);
fs.writeFileSync(path, code);

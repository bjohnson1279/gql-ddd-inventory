import { WebhookWorker } from './infrastructure/workers/WebhookWorker';
import { OutboxWorker } from './infrastructure/workers/OutboxWorker';
import { AuditWorker } from './infrastructure/workers/AuditWorker';
import { WebhookDeliveryWorker } from './infrastructure/workers/WebhookDeliveryWorker';

console.log('[Worker] Starting gql-ddd-inventory background workers...');

WebhookWorker.start();
OutboxWorker.start();
AuditWorker.start();
WebhookDeliveryWorker.start();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Worker] Shutting down workers...');
  WebhookWorker.stop();
  OutboxWorker.stop();
  AuditWorker.stop();
  WebhookDeliveryWorker.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Worker] Shutting down workers...');
  WebhookWorker.stop();
  OutboxWorker.stop();
  AuditWorker.stop();
  WebhookDeliveryWorker.stop();
  process.exit(0);
});

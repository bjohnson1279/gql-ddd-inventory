import { LowStockAlertEvent } from '../../domain/events/InventoryEvents';

export class LowStockAlertHandler {
  async handle(event: LowStockAlertEvent): Promise<void> {
    // In a real application, this might trigger an email service, 
    // a Slack webhook, or an SMS to the store manager.
    console.log(`[LowStockAlertHandler] 🚨 ALERT: SKU ${event.sku} at location ${event.locationId} dropped to ${event.currentQuantity} items!`);
  }
}

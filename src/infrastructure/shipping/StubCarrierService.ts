import { ICarrierService } from '../../application/useCases/ManageShipping';

export class StubCarrierService implements ICarrierService {
  private getDistance(origin: string, destination: string): number {
    const org = origin.toUpperCase();
    const dest = destination.toLowerCase();

    let baseDist = 1000;
    if (org.includes("EAST") && (dest.includes("ny") || dest.includes("new york") || dest.includes("10001"))) baseDist = 100;
    else if (org.includes("WEST") && (dest.includes("la") || dest.includes("los angeles") || dest.includes("ca") || dest.includes("90210"))) baseDist = 100;
    else if (org.includes("CENTRAL") && (dest.includes("chicago") || dest.includes("il") || dest.includes("60601"))) baseDist = 100;
    else if (org.includes("EAST") && (dest.includes("la") || dest.includes("ca") || dest.includes("90210"))) baseDist = 4000;
    else if (org.includes("WEST") && (dest.includes("ny") || dest.includes("new york") || dest.includes("10001"))) baseDist = 4000;

    return baseDist;
  }

  async getRates(sku: string, qty: number, dest: string, origin?: string): Promise<any[]> {
    const weightFactor = sku.length % 3 + 1;
    const baseQuantity = qty || 1;
    const distanceKm = this.getDistance(origin || "default", dest);
    const distanceCost = Math.ceil(distanceKm * 0.1);

    return [
      {
        carrier: "UPS Ground",
        serviceName: "UPS Ground",
        rateCents: Math.ceil((500 + (weightFactor * 50) + distanceCost) * baseQuantity),
        deliveryDays: distanceKm > 2000 ? 5 : 2
      },
      {
        carrier: "FedEx Express",
        serviceName: "FedEx Express",
        rateCents: Math.ceil((1500 + (weightFactor * 100) + distanceCost * 1.5) * baseQuantity),
        deliveryDays: 1
      },
      {
        carrier: "DHL Worldwide",
        serviceName: "DHL Worldwide",
        rateCents: Math.ceil((3500 + (weightFactor * 250) + distanceCost * 2) * baseQuantity),
        deliveryDays: distanceKm > 2000 ? 3 : 1
      },
      {
        carrier: "USPS Priority",
        serviceName: "USPS Priority",
        rateCents: Math.ceil((450 + (weightFactor * 35) + distanceCost * 0.8) * baseQuantity),
        deliveryDays: distanceKm > 2000 ? 6 : 3
      }
    ];
  }

  async purchaseLabel(_: any): Promise<any> {
    return { trackingNumber: '', labelUrl: '', cost: 0 };
  }
}

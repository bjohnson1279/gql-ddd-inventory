import crypto from 'node:crypto';
import { ICarrierService, CarrierRate, LabelResult } from '../../application/ports/ICarrierService';

export class MockCarrierService implements ICarrierService {
  async fetchRates(sku: string, quantity: number, destinationAddress: string): Promise<CarrierRate[]> {
    const weightFactor = sku.length % 3 + 1; // mock item weight factor
    const baseQuantity = quantity || 1;
    
    return [
      {
        carrier: 'UPS Ground',
        rateCents: Math.ceil((500 + (weightFactor * 50)) * baseQuantity),
        estimatedDays: 4
      },
      {
        carrier: 'FedEx Express',
        rateCents: Math.ceil((1500 + (weightFactor * 100)) * baseQuantity),
        estimatedDays: 1
      },
      {
        carrier: 'DHL Worldwide',
        rateCents: Math.ceil((3500 + (weightFactor * 250)) * baseQuantity),
        estimatedDays: 3
      },
      {
        carrier: 'USPS Priority',
        rateCents: Math.ceil((450 + (weightFactor * 35)) * baseQuantity),
        estimatedDays: 5
      }
    ];
  }

  async generateLabel(sku: string, quantity: number, destinationAddress: string, carrier: string): Promise<LabelResult> {
    const rates = await this.fetchRates(sku, quantity, destinationAddress);
    const selectedRate = rates.find(r => r.carrier.toLowerCase() === carrier.toLowerCase()) || rates[0];
    
    const randomSuffix = crypto.randomInt(100000, 1000000);
    let trackingNumber = `TRACK-${randomSuffix}`;
    if (carrier.toLowerCase().includes('ups')) {
      trackingNumber = `1Z999AA1012345${randomSuffix}`;
    } else if (carrier.toLowerCase().includes('fedex')) {
      trackingNumber = `99${randomSuffix}7712`;
    } else if (carrier.toLowerCase().includes('usps')) {
      trackingNumber = `94001118995632${randomSuffix}`;
    }

    const labelUrl = `https://shipping-labels.s3.amazonaws.com/labels/label_${trackingNumber}.pdf`;

    return {
      trackingNumber,
      labelUrl,
      rateCents: selectedRate.rateCents
    };
  }
}

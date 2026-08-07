import * as crypto from 'crypto';

export enum CarrierProvider {
  FEDEX = 'FEDEX',
  UPS = 'UPS',
  DHL = 'DHL',
  GENERIC_LTL = 'GENERIC_LTL',
}

export enum LabelFormatOption {
  ZPL = 'ZPL',
  PDF = 'PDF',
  BOTH = 'BOTH',
}

export interface RateQuoteInput {
  carrier: CarrierProvider;
  originPostalCode: string;
  destinationPostalCode: string;
  weightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  serviceLevel?: string;
}

export interface ShippingRateQuote {
  carrier: CarrierProvider;
  serviceLevel: string;
  baseRateCents: number;
  fuelSurchargeCents: number;
  totalRateCents: number;
  estimatedDeliveryDays: number;
  currency: string;
}

export interface ShippingLabelInput {
  carrier: CarrierProvider;
  recipientName: string;
  shippingAddress: string;
  weightKg: number;
  serviceLevel?: string;
  format?: LabelFormatOption;
}

export interface ShippingLabel {
  carrier: CarrierProvider;
  trackingNumber: string;
  serviceLevel: string;
  labelFormat: LabelFormatOption;
  zplString?: string;
  pdfBase64?: string;
  bolUrl?: string;
  createdAt: string;
}

export class LogisticsService {
  async calculateRates(input: RateQuoteInput): Promise<ShippingRateQuote> {
    const baseDistanceFactor = Math.abs(
      parseInt(input.destinationPostalCode.replace(/\D/g, '') || '90001', 10) -
        parseInt(input.originPostalCode.replace(/\D/g, '') || '10001', 10)
    );

    const baseCents = Math.round(1500 + input.weightKg * 250 + (baseDistanceFactor % 2000));
    const fuelSurchargeCents = Math.round(baseCents * 0.12);
    const totalRateCents = baseCents + fuelSurchargeCents;

    let service = input.serviceLevel || 'GROUND_STANDARD';
    let days = 3;

    if (input.carrier === CarrierProvider.FEDEX) {
      service = input.serviceLevel || 'FEDEX_EXPRESS_SAVER';
      days = 2;
    } else if (input.carrier === CarrierProvider.UPS) {
      service = input.serviceLevel || 'UPS_GROUND';
      days = 3;
    } else if (input.carrier === CarrierProvider.DHL) {
      service = input.serviceLevel || 'EXPRESS_WORLDWIDE';
      days = 1;
    } else if (input.carrier === CarrierProvider.GENERIC_LTL) {
      service = input.serviceLevel || 'FREIGHT_LTL_STANDARD';
      days = 5;
    }

    return {
      carrier: input.carrier,
      serviceLevel: service,
      baseRateCents: baseCents,
      fuelSurchargeCents,
      totalRateCents,
      estimatedDeliveryDays: days,
      currency: 'USD',
    };
  }

  async generateLabel(input: ShippingLabelInput): Promise<ShippingLabel> {
    const format = input.format || LabelFormatOption.BOTH;
    const trackingPrefix =
      input.carrier === CarrierProvider.FEDEX
        ? 'FX'
        : input.carrier === CarrierProvider.UPS
        ? '1Z'
        : input.carrier === CarrierProvider.DHL
        ? 'DHL'
        : 'LTL';

    // Note: randomInt upper bound is exclusive. Math.floor(1e9 + rand * 9e9) has upper bound < 10e9.
    const trackingNumber = `${trackingPrefix}${crypto.randomInt(1000000000, 10000000000)}`;
    const serviceLevel = input.serviceLevel || 'STANDARD_GROUND';

    const zplString =
      format === LabelFormatOption.ZPL || format === LabelFormatOption.BOTH
        ? `^XA^FO50,50^A0N,50,50^FD${input.carrier} SHIPPING LABEL^FS^FO50,120^A0N,30,30^FDTo: ${input.recipientName}^FS^FO50,160^A0N,25,25^FDAddr: ${input.shippingAddress}^FS^FO50,210^BY3^BCN,100,Y,N,N^FD${trackingNumber}^FS^XZ`
        : undefined;

    const pdfBase64 =
      format === LabelFormatOption.PDF || format === LabelFormatOption.BOTH
        ? Buffer.from(`PDF-MOCK-LABEL-${input.carrier}-${trackingNumber}-${input.recipientName}`).toString('base64')
        : undefined;

    const bolUrl =
      input.carrier === CarrierProvider.GENERIC_LTL
        ? `https://logistics.internal/bol/${trackingNumber}.pdf`
        : undefined;

    return {
      carrier: input.carrier,
      trackingNumber,
      serviceLevel,
      labelFormat: format,
      zplString,
      pdfBase64,
      bolUrl,
      createdAt: new Date().toISOString(),
    };
  }
}

export const logisticsService = new LogisticsService();

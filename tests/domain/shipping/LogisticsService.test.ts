import {
  CarrierProvider,
  LabelFormatOption,
  LogisticsService,
  logisticsService,
} from '../../../src/domain/shipping/logisticsService';

describe('LogisticsService', () => {
  let service: LogisticsService;

  beforeEach(() => {
    service = new LogisticsService();
  });

  describe('calculateRates', () => {
    it('should calculate rates for FEDEX with default service level', async () => {
      const quote = await service.calculateRates({
        carrier: CarrierProvider.FEDEX,
        originPostalCode: '10001',
        destinationPostalCode: '90001',
        weightKg: 5,
      });

      expect(quote.carrier).toBe(CarrierProvider.FEDEX);
      expect(quote.serviceLevel).toBe('FEDEX_EXPRESS_SAVER');
      expect(quote.estimatedDeliveryDays).toBe(2);
      expect(quote.currency).toBe('USD');

      // Math: abs(90001 - 10001) = 80000 % 2000 = 0
      // baseCents = 1500 + 5 * 250 + 0 = 2750
      // fuelSurcharge = round(2750 * 0.12) = 330
      // total = 3080
      expect(quote.baseRateCents).toBe(2750);
      expect(quote.fuelSurchargeCents).toBe(330);
      expect(quote.totalRateCents).toBe(3080);
    });

    it('should calculate rates for UPS with default service level', async () => {
      const quote = await service.calculateRates({
        carrier: CarrierProvider.UPS,
        originPostalCode: '10001',
        destinationPostalCode: '10500',
        weightKg: 2,
      });

      expect(quote.carrier).toBe(CarrierProvider.UPS);
      expect(quote.serviceLevel).toBe('UPS_GROUND');
      expect(quote.estimatedDeliveryDays).toBe(3);
      expect(quote.currency).toBe('USD');

      // Math: abs(10500 - 10001) = 499 % 2000 = 499
      // baseCents = 1500 + 2 * 250 + 499 = 2499
      // fuelSurcharge = round(2499 * 0.12) = 300
      // total = 2799
      expect(quote.baseRateCents).toBe(2499);
      expect(quote.fuelSurchargeCents).toBe(300);
      expect(quote.totalRateCents).toBe(2799);
    });

    it('should calculate rates for DHL with default service level', async () => {
      const quote = await service.calculateRates({
        carrier: CarrierProvider.DHL,
        originPostalCode: '10001',
        destinationPostalCode: '10001',
        weightKg: 10,
      });

      expect(quote.carrier).toBe(CarrierProvider.DHL);
      expect(quote.serviceLevel).toBe('EXPRESS_WORLDWIDE');
      expect(quote.estimatedDeliveryDays).toBe(1);

      // Math: abs(10001 - 10001) = 0
      // baseCents = 1500 + 10 * 250 + 0 = 4000
      // fuelSurcharge = round(4000 * 0.12) = 480
      // total = 4480
      expect(quote.baseRateCents).toBe(4000);
      expect(quote.fuelSurchargeCents).toBe(480);
      expect(quote.totalRateCents).toBe(4480);
    });

    it('should calculate rates for GENERIC_LTL with default service level', async () => {
      const quote = await service.calculateRates({
        carrier: CarrierProvider.GENERIC_LTL,
        originPostalCode: '10001',
        destinationPostalCode: '90001',
        weightKg: 100,
      });

      expect(quote.carrier).toBe(CarrierProvider.GENERIC_LTL);
      expect(quote.serviceLevel).toBe('FREIGHT_LTL_STANDARD');
      expect(quote.estimatedDeliveryDays).toBe(5);
    });

    it('should preserve custom service level across carriers', async () => {
      const customFedEx = await service.calculateRates({
        carrier: CarrierProvider.FEDEX,
        originPostalCode: '10001',
        destinationPostalCode: '90001',
        weightKg: 5,
        serviceLevel: 'FEDEX_PRIORITY_OVERNIGHT',
      });
      expect(customFedEx.serviceLevel).toBe('FEDEX_PRIORITY_OVERNIGHT');
      expect(customFedEx.estimatedDeliveryDays).toBe(2);

      const customUps = await service.calculateRates({
        carrier: CarrierProvider.UPS,
        originPostalCode: '10001',
        destinationPostalCode: '90001',
        weightKg: 5,
        serviceLevel: 'UPS_NEXT_DAY_AIR',
      });
      expect(customUps.serviceLevel).toBe('UPS_NEXT_DAY_AIR');
      expect(customUps.estimatedDeliveryDays).toBe(3);

      const customDhl = await service.calculateRates({
        carrier: CarrierProvider.DHL,
        originPostalCode: '10001',
        destinationPostalCode: '90001',
        weightKg: 5,
        serviceLevel: 'DHL_SAME_DAY',
      });
      expect(customDhl.serviceLevel).toBe('DHL_SAME_DAY');
      expect(customDhl.estimatedDeliveryDays).toBe(1);

      const customLtl = await service.calculateRates({
        carrier: CarrierProvider.GENERIC_LTL,
        originPostalCode: '10001',
        destinationPostalCode: '90001',
        weightKg: 5,
        serviceLevel: 'EXPEDITED_LTL',
      });
      expect(customLtl.serviceLevel).toBe('EXPEDITED_LTL');
      expect(customLtl.estimatedDeliveryDays).toBe(5);

      const customOther = await service.calculateRates({
        carrier: 'UNKNOWN_CARRIER' as any,
        originPostalCode: '10001',
        destinationPostalCode: '90001',
        weightKg: 5,
        serviceLevel: 'CUSTOM_OTHER',
      });
      expect(customOther.serviceLevel).toBe('CUSTOM_OTHER');
      expect(customOther.estimatedDeliveryDays).toBe(3);

      const fallbackOther = await service.calculateRates({
        carrier: 'UNKNOWN_CARRIER' as any,
        originPostalCode: '10001',
        destinationPostalCode: '90001',
        weightKg: 5,
      });
      expect(fallbackOther.serviceLevel).toBe('GROUND_STANDARD');
      expect(fallbackOther.estimatedDeliveryDays).toBe(3);
    });

    it('should handle non-digit postal codes using fallback default postal codes', async () => {
      const quote = await service.calculateRates({
        carrier: CarrierProvider.FEDEX,
        originPostalCode: 'ABC-??',
        destinationPostalCode: 'XYZ',
        weightKg: 0,
      });

      // non-digit origin becomes fallback '10001'
      // non-digit destination becomes fallback '90001'
      // abs(90001 - 10001) = 80000 % 2000 = 0
      // baseCents = 1500 + 0 * 250 + 0 = 1500
      expect(quote.baseRateCents).toBe(1500);
      expect(quote.fuelSurchargeCents).toBe(180);
      expect(quote.totalRateCents).toBe(1680);
    });

    it('should handle zero weight and large weight inputs correctly', async () => {
      const zeroWeightQuote = await service.calculateRates({
        carrier: CarrierProvider.UPS,
        originPostalCode: '90001',
        destinationPostalCode: '90001',
        weightKg: 0,
      });
      expect(zeroWeightQuote.baseRateCents).toBe(1500);

      const heavyWeightQuote = await service.calculateRates({
        carrier: CarrierProvider.GENERIC_LTL,
        originPostalCode: '10001',
        destinationPostalCode: '10001',
        weightKg: 2000,
        lengthCm: 120,
        widthCm: 80,
        heightCm: 150,
      });
      // 1500 + 2000 * 250 + 0 = 501500
      expect(heavyWeightQuote.baseRateCents).toBe(501500);
      expect(heavyWeightQuote.fuelSurchargeCents).toBe(Math.round(501500 * 0.12));
    });
  });

  describe('generateLabel', () => {
    it('should generate label for FEDEX with FX prefix and default format BOTH', async () => {
      const label = await service.generateLabel({
        carrier: CarrierProvider.FEDEX,
        recipientName: 'Alice Smith',
        shippingAddress: '123 Main St, New York, NY',
        weightKg: 3.5,
      });

      expect(label.carrier).toBe(CarrierProvider.FEDEX);
      expect(label.trackingNumber).toMatch(/^FX\d{10}$/);
      expect(label.serviceLevel).toBe('STANDARD_GROUND');
      expect(label.labelFormat).toBe(LabelFormatOption.BOTH);
      expect(label.zplString).toContain('^XA');
      expect(label.zplString).toContain('FEDEX SHIPPING LABEL');
      expect(label.zplString).toContain('To: Alice Smith');
      expect(label.zplString).toContain('Addr: 123 Main St, New York, NY');
      expect(label.zplString).toContain(label.trackingNumber);
      expect(label.pdfBase64).toBeDefined();

      const decodedPdf = Buffer.from(label.pdfBase64!, 'base64').toString('utf8');
      expect(decodedPdf).toBe(`PDF-MOCK-LABEL-FEDEX-${label.trackingNumber}-Alice Smith`);
      expect(label.bolUrl).toBeUndefined();
      expect(new Date(label.createdAt).getTime()).not.toBeNaN();
    });

    it('should generate label for UPS with 1Z prefix', async () => {
      const label = await service.generateLabel({
        carrier: CarrierProvider.UPS,
        recipientName: 'Bob Jones',
        shippingAddress: '456 Oak Ave, Los Angeles, CA',
        weightKg: 10,
      });

      expect(label.carrier).toBe(CarrierProvider.UPS);
      expect(label.trackingNumber).toMatch(/^1Z\d{10}$/);
      expect(label.bolUrl).toBeUndefined();
    });

    it('should generate label for DHL with DHL prefix', async () => {
      const label = await service.generateLabel({
        carrier: CarrierProvider.DHL,
        recipientName: 'Charlie Brown',
        shippingAddress: '789 Pine Rd, Chicago, IL',
        weightKg: 1.2,
      });

      expect(label.carrier).toBe(CarrierProvider.DHL);
      expect(label.trackingNumber).toMatch(/^DHL\d{10}$/);
      expect(label.bolUrl).toBeUndefined();
    });

    it('should generate label for GENERIC_LTL with LTL prefix and BOL URL', async () => {
      const label = await service.generateLabel({
        carrier: CarrierProvider.GENERIC_LTL,
        recipientName: 'Acme Corp Warehouse',
        shippingAddress: '100 Industrial Pkwy, Dallas, TX',
        weightKg: 500,
        serviceLevel: 'LTL_FREIGHT_PRIORITY',
      });

      expect(label.carrier).toBe(CarrierProvider.GENERIC_LTL);
      expect(label.trackingNumber).toMatch(/^LTL\d{10}$/);
      expect(label.serviceLevel).toBe('LTL_FREIGHT_PRIORITY');
      expect(label.bolUrl).toBe(`https://logistics.internal/bol/${label.trackingNumber}.pdf`);
    });

    it('should handle custom carrier fallback prefix LTL', async () => {
      const label = await service.generateLabel({
        carrier: 'CUSTOM_FREIGHT' as any,
        recipientName: 'Test Recipient',
        shippingAddress: 'Test Address',
        weightKg: 20,
      });

      expect(label.trackingNumber).toMatch(/^LTL\d{10}$/);
    });

    it('should generate only ZPL string when format is ZPL', async () => {
      const label = await service.generateLabel({
        carrier: CarrierProvider.UPS,
        recipientName: 'Dave Lee',
        shippingAddress: '321 Maple St, Seattle, WA',
        weightKg: 4,
        format: LabelFormatOption.ZPL,
      });

      expect(label.labelFormat).toBe(LabelFormatOption.ZPL);
      expect(label.zplString).toBeDefined();
      expect(label.pdfBase64).toBeUndefined();
    });

    it('should generate only PDF base64 when format is PDF', async () => {
      const label = await service.generateLabel({
        carrier: CarrierProvider.FEDEX,
        recipientName: 'Eve White',
        shippingAddress: '654 Elm St, Miami, FL',
        weightKg: 2,
        format: LabelFormatOption.PDF,
      });

      expect(label.labelFormat).toBe(LabelFormatOption.PDF);
      expect(label.zplString).toBeUndefined();
      expect(label.pdfBase64).toBeDefined();
    });
  });

  describe('singleton export', () => {
    it('should export an instance of LogisticsService', () => {
      expect(logisticsService).toBeInstanceOf(LogisticsService);
    });
  });
});

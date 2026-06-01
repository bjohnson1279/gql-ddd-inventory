import { GetSerializedItemBySerialUseCase } from '../../../src/application/useCases/ManageSerializedItems';
import { ISerializedItemRepository } from '../../../src/domain/repositories/ISerializedItemRepository';
import { SerialNumber } from '../../../src/domain/valueObjects/SerialNumber';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';

describe('ManageSerializedItems', () => {
  let mockSerialsRepo: jest.Mocked<ISerializedItemRepository>;

  beforeEach(() => {
    mockSerialsRepo = {
      isRegistered: jest.fn(),
      save: jest.fn(),
      findBySerial: jest.fn(),
      findByVariant: jest.fn(),
    } as any;
  });

  describe('GetSerializedItemBySerialUseCase', () => {
    it('should return the serialized item when found', async () => {
      const mockItem = { serialNumber: new SerialNumber('SN-999'), tenantId: new TenantId('tenant-1') } as any;
      mockSerialsRepo.findBySerial.mockResolvedValue(mockItem);

      const useCase = new GetSerializedItemBySerialUseCase(mockSerialsRepo);
      const result = await useCase.execute('SN-999', 'tenant-1');

      expect(mockSerialsRepo.findBySerial).toHaveBeenCalledWith(
        new SerialNumber('SN-999'),
        new TenantId('tenant-1')
      );
      expect(result).toBe(mockItem);
    });

    it('should return null when the serialized item is not found', async () => {
      mockSerialsRepo.findBySerial.mockResolvedValue(null);

      const useCase = new GetSerializedItemBySerialUseCase(mockSerialsRepo);
      const result = await useCase.execute('SN-UNKNOWN', 'tenant-1');

      expect(mockSerialsRepo.findBySerial).toHaveBeenCalledWith(
        new SerialNumber('SN-UNKNOWN'),
        new TenantId('tenant-1')
      );
      expect(result).toBeNull();
    });
  });
});

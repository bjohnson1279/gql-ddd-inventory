import { AutoRetryDecorator } from '../../../src/application/decorators/AutoRetryDecorator';
import { ConcurrencyError, InvalidOperationError } from '../../../src/domain/exceptions/DomainErrors';

describe('AutoRetryDecorator (GraphQL)', () => {
  it('should successfully execute if it never throws an error', async () => {
    const mockUseCase = {
      execute: jest.fn().mockResolvedValue('success-val')
    };

    const decorated = AutoRetryDecorator.wrap(mockUseCase, 3, 1);
    const result = await decorated.execute('input-arg');

    expect(result).toBe('success-val');
    expect(mockUseCase.execute).toHaveBeenCalledTimes(1);
    expect(mockUseCase.execute).toHaveBeenCalledWith('input-arg');
  });

  it('should retry on ConcurrencyError and succeed if resolved within limit', async () => {
    let callCount = 0;
    const mockUseCase = {
      execute: jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw new ConcurrencyError('SKU-1', 'LOC-1');
        }
        return 'success-on-third';
      })
    };

    const decorated = AutoRetryDecorator.wrap(mockUseCase, 3, 5);
    const result = await decorated.execute();

    expect(result).toBe('success-on-third');
    expect(mockUseCase.execute).toHaveBeenCalledTimes(3);
  });

  it('should propagate ConcurrencyError if retries exceed the maximum limit', async () => {
    const mockUseCase = {
      execute: jest.fn().mockImplementation(async () => {
        throw new ConcurrencyError('SKU-1', 'LOC-1');
      })
    };

    const decorated = AutoRetryDecorator.wrap(mockUseCase, 2, 5);

    await expect(decorated.execute()).rejects.toThrow(ConcurrencyError);
    expect(mockUseCase.execute).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('should not retry and immediately propagate non-concurrency errors', async () => {
    const mockUseCase = {
      execute: jest.fn().mockImplementation(async () => {
        throw new InvalidOperationError('Some other error');
      })
    };

    const decorated = AutoRetryDecorator.wrap(mockUseCase, 3, 5);

    await expect(decorated.execute()).rejects.toThrow(InvalidOperationError);
    expect(mockUseCase.execute).toHaveBeenCalledTimes(1);
  });
});

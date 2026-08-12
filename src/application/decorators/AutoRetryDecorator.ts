import { ConcurrencyError } from '../../domain/exceptions/DomainErrors';

export class AutoRetryDecorator {
  static wrap<Args extends any[], R, T extends { execute: (...args: Args) => Promise<R> }>(
    useCase: T,
    maxRetries: number = 3,
    baseDelayMs: number = 100
  ): T {
    return new Proxy(useCase, {
      get(target, prop, receiver) {
        if (prop === 'execute') {
          return async (...args: Args): Promise<R> => {
            let attempts = 0;
            while (true) {
              try {
                return await target.execute(...args);
              } catch (error: any) {
                const isConcurrency =
                  error instanceof ConcurrencyError ||
                  error?.name === 'ConcurrencyError' ||
                  (error?.message && error.message.toLowerCase().includes('concurrency'));

                if (isConcurrency && attempts < maxRetries) {
                  attempts++;
                  const delay = baseDelayMs * Math.pow(2, attempts - 1);
                  console.warn(
                    `[AutoRetry] Concurrency error detected in ${target.constructor.name}. Retrying (attempt ${attempts}/${maxRetries}) in ${delay}ms...`
                  );
                  await new Promise((resolve) => setTimeout(resolve, delay));
                  continue;
                }
                throw error;
              }
            }
          };
        }
        return Reflect.get(target, prop, receiver);
      }
    });
  }
}

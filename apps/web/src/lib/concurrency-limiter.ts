/**
 * Configuration interface for concurrency limiting
 */
export interface ConcurrencyConfig {
  /** Maximum number of concurrent requests allowed */
  maxConcurrent: number;
  /** Batch size for processing requests in chunks */
  batchSize?: number;
}

/**
 * Default concurrency configuration
 */
export const DEFAULT_CONCURRENCY_CONFIG: ConcurrencyConfig = {
  maxConcurrent: 5, // Conservative default to avoid overwhelming APIs
  batchSize: 10,
};

/**
 * Utility class for limiting concurrent async operations
 */
export class ConcurrencyLimiter {
  private config: ConcurrencyConfig;
  private activeCount: number = 0;
  private queue: Array<() => void> = [];

  constructor(config: ConcurrencyConfig = DEFAULT_CONCURRENCY_CONFIG) {
    this.config = { ...DEFAULT_CONCURRENCY_CONFIG, ...config };
  }

  /**
   * Execute a function with concurrency limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeTask = async () => {
        this.activeCount++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeCount--;
          this.processQueue();
        }
      };

      if (this.activeCount < this.config.maxConcurrent) {
        executeTask();
      } else {
        this.queue.push(executeTask);
      }
    });
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.activeCount < this.config.maxConcurrent) {
      const nextTask = this.queue.shift();
      if (nextTask) {
        nextTask();
      }
    }
  }
}

/**
 * Process an array of items in batches with concurrency limiting
 */
export async function processConcurrently<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  config: ConcurrencyConfig = DEFAULT_CONCURRENCY_CONFIG,
): Promise<R[]> {
  const limiter = new ConcurrencyLimiter(config);
  const results: R[] = [];

  // Process items in batches if batchSize is specified
  if (config.batchSize && items.length > config.batchSize) {
    for (let i = 0; i < items.length; i += config.batchSize) {
      const batch = items.slice(i, i + config.batchSize);
      const batchPromises = batch.map((item) =>
        limiter.execute(() => processor(item)),
      );
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(
        ...batchResults
          .filter((r) => r.status === "fulfilled")
          .map((r) => (r as PromiseFulfilledResult<R>).value),
      );
    }
  } else {
    const promises = items.map((item) =>
      limiter.execute(() => processor(item)),
    );
    const settledResults = await Promise.allSettled(promises);
    results.push(
      ...settledResults
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<R>).value),
    );
  }

  return results;
}

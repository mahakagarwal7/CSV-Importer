import { logger } from './logger';

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  onRetry?: (error: any, attempt: number) => void;
}

export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const {
    maxRetries = 3,
    initialDelayMs = 500,
    backoffFactor = 2,
    onRetry,
  } = options;

  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;

      // We only want to retry on transient errors (like 429, 5xx, or network timeouts).
      // Validation errors (400) shouldn't be retried.
      // We will assume that any error that reaches here from AI is retryable,
      // unless we specifically add logic to check status codes if available.
      
      if (attempt > maxRetries) {
        logger.error({ error, attempt }, `Max retries (${maxRetries}) reached. Failing.`);
        throw error;
      }

      logger.warn({ error, attempt, nextDelay: delay }, 'Operation failed. Retrying...');
      
      if (onRetry) {
        onRetry(error, attempt);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= backoffFactor;
    }
  }
};

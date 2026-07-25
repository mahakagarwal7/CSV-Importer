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
        logger.error({ error: error.message || error, attempt }, `Max retries (${maxRetries}) reached. Failing.`);
        throw error;
      }

      // Automatically inspect for Google Cloud HTTP 429 Rate Limit or Quota exhaustion
      const errStr = String(error?.message || error?.error?.message || JSON.stringify(error)).toLowerCase();
      let actualDelay = delay;
      if (error?.status === 429 || errStr.includes('429') || errStr.includes('quota') || errStr.includes('resource_exhausted')) {
        logger.warn(`[API Rate Limit 429 Detected] Google Free Tier throttling encountered on attempt ${attempt}.`);
        // Check if error tells us how long to wait (e.g., "Please retry in 8.96s")
        const match = errStr.match(/retry in ([\d\.]+)s/);
        if (match && match[1]) {
          actualDelay = Math.ceil(parseFloat(match[1]) * 1000) + 1500; // Requested wait plus 1.5s safety margin
        } else {
          actualDelay = Math.max(delay, 10000); // Default to 10s cooldown for 429 rate limits
        }
        logger.warn(`Throttling active: Waiting ${actualDelay / 1000} seconds before attempting batch retry...`);
      } else {
        logger.warn({ error: error.message || error, attempt, nextDelay: actualDelay }, 'Operation failed. Retrying...');
      }

      if (onRetry) {
        onRetry(error, attempt);
      }

      await new Promise((resolve) => setTimeout(resolve, actualDelay));
      delay = actualDelay * backoffFactor;
    }
  }
};

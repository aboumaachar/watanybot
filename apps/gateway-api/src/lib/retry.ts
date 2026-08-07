/**
 * Exponential Backoff Retry Utility
 * 
 * Implements retry logic with exponential backoff for AI provider calls
 * and other network operations.
 * 
 * Configuration:
 * - AI_RETRY_COUNT: number of retries (default: 3)
 * - AI_RETRY_BASE_DELAY_MS: initial delay in milliseconds (default: 100)
 * - AI_RETRY_MAX_DELAY_MS: maximum delay in milliseconds (default: 30000)
 * - AI_RETRY_BACKOFF_FACTOR: exponential multiplier (default: 2)
 */

type RetryableFunction<T> = () => Promise<T>;

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Determine if an error is retryable (transient)
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  const message = error.message.toLowerCase();
  
  // Timeout errors
  if (message.includes("timeout") || message.includes("timed out")) return true;
  
  // Network errors
  if (message.includes("econnreset") || message.includes("econnrefused")) return true;
  if (message.includes("network") || message.includes("fetch")) return true;
  
  // Temporary service issues
  if (error instanceof TypeError && message.includes("fetch")) return true;
  
  return false;
}

/**
 * Run a function with exponential backoff retry
 * 
 * @param fn Function to retry
 * @param options Retry configuration
 * @returns Result of successful function call
 * @throws Last error if all attempts fail
 */
export async function withExponentialBackoff<T>(
  fn: RetryableFunction<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 100;
  const maxDelayMs = options.maxDelayMs ?? 30000;
  const backoffFactor = options.backoffFactor ?? 2;
  const shouldRetry = options.shouldRetry ?? isRetryableError;
  const onRetry = options.onRetry;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isRetryable = shouldRetry(lastError);
      const isLastAttempt = attempt === maxAttempts;

      if (!isRetryable || isLastAttempt) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const exponentialDelay = baseDelayMs * Math.pow(backoffFactor, attempt - 1);
      const delayMs = Math.min(exponentialDelay, maxDelayMs);

      // Add jitter (0-20% random variation) to prevent thundering herd
      const jitter = delayMs * (Math.random() * 0.2);
      const actualDelayMs = Math.floor(delayMs + jitter);

      if (onRetry) {
        onRetry(attempt, lastError, actualDelayMs);
      }

      await new Promise((resolve) => setTimeout(resolve, actualDelayMs));
    }
  }

  // TypeScript requires this even though we always throw above
  throw lastError || new Error("Unknown error");
}

/**
 * Create a wrapped function that automatically retries with exponential backoff
 */
export function createRetryWrapper<T, A extends unknown[]>(
  fn: (...args: A) => Promise<T>,
  options: RetryOptions = {}
) {
  return async (...args: A): Promise<T> => {
    return withExponentialBackoff(() => fn(...args), options);
  };
}

/**
 * Configuration from environment variables
 */
export function getRetryConfig(): RetryOptions {
  return {
    maxAttempts: Number(process.env.AI_RETRY_COUNT ?? "3"),
    baseDelayMs: Number(process.env.AI_RETRY_BASE_DELAY_MS ?? "100"),
    maxDelayMs: Number(process.env.AI_RETRY_MAX_DELAY_MS ?? "30000"),
    backoffFactor: Number(process.env.AI_RETRY_BACKOFF_FACTOR ?? "2"),
  };
}

/**
 * Specific retry configuration for AI provider calls
 */
export function getAiRetryConfig(): RetryOptions {
  const baseConfig = getRetryConfig();
  
  // AI calls should be more aggressive with retries
  // since timeouts are common with Ollama/cheap models
  return {
    ...baseConfig,
    maxAttempts: Math.max(baseConfig.maxAttempts ?? 3, 3),
    baseDelayMs: baseConfig.baseDelayMs ?? 500, // Longer initial delay for AI
    maxDelayMs: baseConfig.maxDelayMs ?? 45000, // Longer max for AI
  };
}

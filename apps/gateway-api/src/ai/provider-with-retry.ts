/**
 * Wrapper for AI Provider with Automatic Retry & Exponential Backoff
 * 
 * Applies retry logic to all AI provider methods:
 * - complete() — non-streaming completions
 * - stream() — streaming completions
 * 
 * Uses exponential backoff with jitter to improve reliability for:
 * - Network timeouts
 * - Temporary service unavailability
 * - Rate limiting
 */

import type { AiChatProvider, AiMessage, AiProviderConfig, AiStreamCallback } from "./types";
import { withExponentialBackoff, getAiRetryConfig } from "../lib/retry";

/**
 * Wrap an AI provider to add automatic retry and exponential backoff
 */
export function withRetryWrapper(provider: AiChatProvider): AiChatProvider {
  const retryConfig = getAiRetryConfig();
  const logger = {
    warn: (msg: string, data?: any) => {
      if (process.env.LOG_LEVEL === "debug") {
        console.warn(`[AI Retry] ${msg}`, data || "");
      }
    },
  };

  return {
    name: provider.name,

    async complete(
      messages: AiMessage[],
      options?: Partial<AiProviderConfig>
    ): Promise<string> {
      return withExponentialBackoff(
        () => provider.complete(messages, options),
        {
          ...retryConfig,
          onRetry: (attempt, error, delayMs) => {
            logger.warn(`complete() retry`, {
              attempt,
              error: error.message,
              delayMs,
              provider: provider.name,
            });
          },
        }
      );
    },

    async stream(
      messages: AiMessage[],
      onEvent: AiStreamCallback,
      options?: Partial<AiProviderConfig>
    ): Promise<string> {
      return withExponentialBackoff(
        () => provider.stream(messages, onEvent, options),
        {
          ...retryConfig,
          onRetry: (attempt, error, delayMs) => {
            logger.warn(`stream() retry`, {
              attempt,
              error: error.message,
              delayMs,
              provider: provider.name,
            });
          },
        }
      );
    },

    async healthCheck() {
      return provider.healthCheck();
    },
  };
}

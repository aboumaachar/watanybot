/**
 * bootstrap/circuit-breakers.ts
 * Creates the three circuit-breaker instances used across the gateway.
 * Import and call createCircuitBreakers() once at startup.
 */
import { createCircuitBreaker } from "../lib/circuit-breaker";
import {
  kbCbThreshold, kbCbTimeout,
  pythonCbThreshold, pythonCbTimeout,
  aiCbThreshold, aiCbTimeout,
} from "../lib/config";

export type CircuitBreakers = {
  kbCircuitBreaker: ReturnType<typeof createCircuitBreaker>;
  pythonApiCircuitBreaker: ReturnType<typeof createCircuitBreaker>;
  aiProviderCircuitBreaker: ReturnType<typeof createCircuitBreaker>;
};

export function createCircuitBreakers(): CircuitBreakers {
  return {
    kbCircuitBreaker:        createCircuitBreaker("kb-search",    { failureThreshold: kbCbThreshold,     resetTimeout: kbCbTimeout }),
    pythonApiCircuitBreaker: createCircuitBreaker("python-api",   { failureThreshold: pythonCbThreshold,  resetTimeout: pythonCbTimeout }),
    aiProviderCircuitBreaker: createCircuitBreaker("ai-provider", { failureThreshold: aiCbThreshold,      resetTimeout: aiCbTimeout }),
  };
}

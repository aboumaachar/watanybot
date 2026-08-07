/**
 * Circuit Breaker Pattern Implementation
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failure threshold exceeded, requests rejected immediately
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 * 
 * Configuration via environment variables:
 * - CIRCUIT_BREAKER_THRESHOLD: Number of failures to open (default: 5)
 * - CIRCUIT_BREAKER_TIMEOUT: Time in ms to wait before trying HALF_OPEN (default: 30000)
 * - CIRCUIT_BREAKER_RESET_TIMEOUT: Time in ms to reset failure count if no failures (default: 60000)
 */

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  failureThreshold?: number; // Failures before opening (default: 5)
  resetTimeout?: number; // Time in ms before trying HALF_OPEN (default: 30000)
  resetCountTimeout?: number; // Time in ms without failures to reset count (default: 60000)
}

export class CircuitBreakerError extends Error {
  constructor(message: string, public state: CircuitBreakerState) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

/**
 * Circuit Breaker for fault tolerance
 * Prevents cascading failures when downstream services are unavailable
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;
  private lastAttemptTime = 0;
  private successCount = 0;

  private failureThreshold: number;
  private resetTimeout: number;
  private resetCountTimeout: number;

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold || Number(process.env.CIRCUIT_BREAKER_THRESHOLD || "5");
    this.resetTimeout = config.resetTimeout || Number(process.env.CIRCUIT_BREAKER_TIMEOUT || "30000");
    this.resetCountTimeout = config.resetCountTimeout || Number(process.env.CIRCUIT_BREAKER_RESET_COUNT_TIMEOUT || "60000");
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitBreakerState {
    // Check if HALF_OPEN should transition back to CLOSED
    if (this.state === "HALF_OPEN" && this.successCount >= 3) {
      this.transitionToClosed();
    }

    // Check if OPEN should transition to HALF_OPEN
    if (this.state === "OPEN" && Date.now() - this.lastFailureTime > this.resetTimeout) {
      this.transitionToHalfOpen();
    }

    // Check if failure count should reset
    if (this.failureCount > 0 && Date.now() - this.lastFailureTime > this.resetCountTimeout) {
      this.failureCount = 0;
    }

    return this.state;
  }

  /**
   * Execute a function through the circuit breaker
   * Throws CircuitBreakerError if circuit is OPEN
   */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    // Reject if circuit is open
    if (currentState === "OPEN") {
      throw new CircuitBreakerError(
        `Circuit breaker is OPEN (failures: ${this.failureCount}/${this.failureThreshold})`,
        "OPEN"
      );
    }

    this.lastAttemptTime = Date.now();

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a successful call
   */
  private recordSuccess(): void {
    this.successCount++;
    this.failureCount = Math.max(0, this.failureCount - 1);

    if (this.state === "HALF_OPEN" && this.successCount >= 3) {
      this.transitionToClosed();
    }
  }

  /**
   * Record a failed call
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold && this.state !== "OPEN") {
      this.transitionToOpen();
    }
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.successCount = 0;
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    this.state = "OPEN";
    this.lastFailureTime = Date.now();
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    this.state = "HALF_OPEN";
    this.successCount = 0;
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics() {
    return {
      state: this.getState(),
      failures: this.failureCount,
      threshold: this.failureThreshold,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastAttemptTime: this.lastAttemptTime,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.transitionToClosed();
  }
}

/**
 * Create a circuit breaker instance with a name for logging
 */
export function createCircuitBreaker(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
  const breaker = new CircuitBreaker(config);
  // Name can be used for logging if integration with logger is needed
  return breaker;
}

/**
 * Circuit breaker to prevent cascading failures.
 *
 * Three states:
 *   closed  → normal operation, requests flow through
 *   open    → failures exceeded threshold, fast-fail all requests
 *   half-open → after resetTimeout, allow one probe request through
 *
 * Configurable per-service — SSH connections need different thresholds
 * than rate-limited APIs or local databases.
 */

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold: number;
  /** Milliseconds to wait before transitioning from open → half-open */
  resetTimeout: number;
  /** Number of successes in half-open state before closing the circuit */
  successThreshold: number;
}

/** Sensible defaults per service type */
export const BREAKER_PRESETS: Record<string, CircuitBreakerConfig> = {
  /** SSH — network blips common, but 3 consecutive means host is down */
  ssh: { failureThreshold: 3, resetTimeout: 60_000, successThreshold: 2 },
  /** Rate-limited APIs (Shopify, Meta) — 30s reset just hits the limit again */
  'rate-limited-api': { failureThreshold: 5, resetTimeout: 120_000, successThreshold: 2 },
  /** Local database — if it's down, something is very wrong. Trip fast, recover fast */
  postgres: { failureThreshold: 2, resetTimeout: 10_000, successThreshold: 1 },
  /** External APIs (context7, GSC, etc.) — balanced defaults */
  'external-api': { failureThreshold: 5, resetTimeout: 30_000, successThreshold: 2 },
  /** Child process proxies — if the process crashes, give it time to restart */
  proxy: { failureThreshold: 3, resetTimeout: 15_000, successThreshold: 1 },
} as const;

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly config: CircuitBreakerConfig;
  readonly name: string;

  constructor(name: string, config?: Partial<CircuitBreakerConfig>) {
    this.name = name;
    const preset = BREAKER_PRESETS[name] ?? BREAKER_PRESETS['external-api']!;
    this.config = { ...preset, ...config };
  }

  isOpen(): boolean {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = 'half-open';
        this.successCount = 0;
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = 'closed';
      }
    }
  }

  recordFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): CircuitState {
    // Trigger the open → half-open transition check
    this.isOpen();
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

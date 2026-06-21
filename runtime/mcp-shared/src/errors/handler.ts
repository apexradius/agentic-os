/**
 * UnifiedErrorHandler — wraps operations with retry logic, circuit breakers,
 * and structured error classification.
 *
 * Per-service configuration: different services need different retry
 * strategies. SSH needs longer initial delays (~1s), local DB needs
 * shorter delays (~50ms), external APIs use the defaults.
 */

import { CircuitBreaker, type CircuitBreakerConfig } from './circuit-breaker.js';
import { ErrorClassifier, type ClassifierFn } from './classifier.js';
import { ErrorSeverity, ErrorType, McpError, type StandardError } from './types.js';
import { log } from '../logging/index.js';

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
  backoffMultiplier: number;
}

/** Sensible defaults per service type */
export const RETRY_PRESETS: Record<string, RetryConfig> = {
  ssh: { maxRetries: 2, initialDelayMs: 1000, maxDelayMs: 30_000, jitterFactor: 0.1, backoffMultiplier: 2 },
  postgres: { maxRetries: 3, initialDelayMs: 50, maxDelayMs: 5_000, jitterFactor: 0.1, backoffMultiplier: 2 },
  'rate-limited-api': { maxRetries: 3, initialDelayMs: 2000, maxDelayMs: 60_000, jitterFactor: 0.2, backoffMultiplier: 3 },
  'external-api': { maxRetries: 3, initialDelayMs: 100, maxDelayMs: 10_000, jitterFactor: 0.1, backoffMultiplier: 2 },
  proxy: { maxRetries: 2, initialDelayMs: 200, maxDelayMs: 5_000, jitterFactor: 0.1, backoffMultiplier: 2 },
  default: { maxRetries: 3, initialDelayMs: 100, maxDelayMs: 10_000, jitterFactor: 0.1, backoffMultiplier: 2 },
} as const;

export interface ErrorHandlerOptions {
  /** MCP server name (e.g. 'apex-data-mcp') — used in log prefixes */
  mcpName: string;
  /** Per-service retry config overrides */
  retryOverrides?: Record<string, Partial<RetryConfig>>;
  /** Per-service circuit breaker config overrides */
  breakerOverrides?: Record<string, Partial<CircuitBreakerConfig>>;
}

export class UnifiedErrorHandler {
  private readonly circuits = new Map<string, CircuitBreaker>();
  private readonly retryConfigs = new Map<string, RetryConfig>();
  private readonly classifier: ErrorClassifier;
  readonly mcpName: string;

  constructor(opts: ErrorHandlerOptions) {
    this.mcpName = opts.mcpName;
    this.classifier = new ErrorClassifier();

    // Apply per-service retry overrides
    if (opts.retryOverrides) {
      for (const [service, overrides] of Object.entries(opts.retryOverrides)) {
        const base = RETRY_PRESETS[service] ?? RETRY_PRESETS['default']!;
        this.retryConfigs.set(service, { ...base, ...overrides });
      }
    }

    // Apply per-service breaker overrides
    if (opts.breakerOverrides) {
      for (const [service, overrides] of Object.entries(opts.breakerOverrides)) {
        this.circuits.set(service, new CircuitBreaker(service, overrides));
      }
    }
  }

  /** Register a service-specific error classifier */
  registerClassifier(fn: ClassifierFn): this {
    this.classifier.register(fn);
    return this;
  }

  /** Get or create a circuit breaker for a service */
  private getBreaker(service: string): CircuitBreaker {
    let breaker = this.circuits.get(service);
    if (!breaker) {
      breaker = new CircuitBreaker(service);
      this.circuits.set(service, breaker);
    }
    return breaker;
  }

  /** Get retry config for a service */
  private getRetryConfig(service: string): RetryConfig {
    return this.retryConfigs.get(service) ?? RETRY_PRESETS[service] ?? RETRY_PRESETS['default']!;
  }

  /**
   * Execute an operation with circuit breaker protection and retry logic.
   *
   * @param service  - Service name for breaker + classifier (e.g. 'postgres', 'ssh')
   * @param operation - Operation name for logging (e.g. 'pg_query', 'ssh_execute')
   * @param fn - The async operation to execute
   */
  async executeWithRetry<T>(
    service: string,
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const breaker = this.getBreaker(service);
    const retryConfig = this.getRetryConfig(service);

    // Check circuit breaker
    if (breaker.isOpen()) {
      const err: StandardError = {
        type: ErrorType.SERVICE_UNAVAILABLE,
        severity: ErrorSeverity.DEGRADED,
        message: `${service} circuit breaker open — service is recovering`,
        context: { service, operation },
        isRetryable: false,
        suggestedAction: `${service} is temporarily unavailable. Try again later.`,
      };
      log.warn(this.mcpName, service, operation, `Circuit breaker open for ${service}`);
      throw new McpError(err);
    }

    // Try with exponential backoff
    let lastError: StandardError | undefined;
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const result = await fn();
        breaker.recordSuccess();
        return result;
      } catch (rawError) {
        const classified = this.classifier.classify(rawError, service, operation);
        classified.context = { ...classified.context, service, operation, retryCount: attempt };
        lastError = classified;

        // Non-retryable → fail immediately
        if (!classified.isRetryable || attempt === retryConfig.maxRetries) {
          breaker.recordFailure();
          log.error(this.mcpName, service, operation,
            `Failed (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}): ${classified.message}`);
          throw new McpError(classified);
        }

        // Calculate backoff delay
        const delay = this.calculateBackoff(attempt, retryConfig);
        classified.context!.nextRetryAt = new Date(Date.now() + delay);

        log.warn(this.mcpName, service, operation,
          `Retry ${attempt + 1}/${retryConfig.maxRetries} in ${delay}ms: ${classified.message}`);

        await this.sleep(delay);
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new McpError(lastError!);
  }

  /**
   * Execute without retry — just classify errors and record breaker state.
   * Use for operations that should not be retried (e.g. mutations).
   */
  async executeOnce<T>(
    service: string,
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const breaker = this.getBreaker(service);

    if (breaker.isOpen()) {
      throw new McpError({
        type: ErrorType.SERVICE_UNAVAILABLE,
        severity: ErrorSeverity.DEGRADED,
        message: `${service} circuit breaker open`,
        context: { service, operation },
        isRetryable: false,
      });
    }

    try {
      const result = await fn();
      breaker.recordSuccess();
      return result;
    } catch (rawError) {
      const classified = this.classifier.classify(rawError, service, operation);
      breaker.recordFailure();
      throw new McpError(classified);
    }
  }

  /** Classify an error without executing (for manual handling) */
  classify(error: unknown, service: string, operation: string): StandardError {
    return this.classifier.classify(error, service, operation);
  }

  /** Get all circuit breaker states for health checks */
  getCircuitStates(): Record<string, { state: string; name: string }> {
    const states: Record<string, { state: string; name: string }> = {};
    for (const [name, breaker] of this.circuits) {
      states[name] = { state: breaker.getState(), name };
    }
    return states;
  }

  private calculateBackoff(attempt: number, config: RetryConfig): number {
    const baseDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
    const capped = Math.min(baseDelay, config.maxDelayMs);
    const jitter = capped * config.jitterFactor * Math.random();
    return Math.round(capped + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

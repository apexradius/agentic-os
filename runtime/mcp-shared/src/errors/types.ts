/**
 * Error classification system for all Apex MCP servers.
 * Every error gets classified by severity and type to enable correct handling.
 */

export enum ErrorSeverity {
  /** Stop MCP, don't retry — requires manual fix */
  FATAL = 'fatal',
  /** Service unavailable, continue others */
  DEGRADED = 'degraded',
  /** Retry with backoff */
  TRANSIENT = 'transient',
  /** Validation failure, no retry */
  USER_ERROR = 'user_error',
}

export enum ErrorType {
  /** Invalid token, key, or permission */
  AUTH = 'auth',
  /** Too many requests */
  RATE_LIMIT = 'rate_limit',
  /** Resource doesn't exist */
  NOT_FOUND = 'not_found',
  /** Bad input */
  VALIDATION = 'validation',
  /** Connection refused, timeout at network level */
  NETWORK = 'network',
  /** 503, service down */
  SERVICE_UNAVAILABLE = 'service_unavailable',
  /** Request exceeded time limit */
  TIMEOUT = 'timeout',
  /** SQL or database error */
  DATABASE = 'database',
  /** SSH connection or auth issue */
  SSH = 'ssh',
  /** Third-party API failure */
  EXTERNAL_API = 'external_api',
  /** Cannot determine type */
  UNKNOWN = 'unknown',
}

export interface ErrorContext {
  /** Service name: 'shopify', 'gmail', 'n8n', 'ssh', 'postgres', etc. */
  service: string;
  /** Operation name: 'list_products', 'send_email', etc. */
  operation: string;
  /** Current retry attempt (0-based) */
  retryCount?: number;
  /** When the next retry will be attempted */
  nextRetryAt?: Date;
}

export interface StandardError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  code?: string;
  context?: ErrorContext;
  originalError?: Error;
  isRetryable: boolean;
  suggestedAction?: string;
}

export class McpError extends Error implements StandardError {
  readonly type: ErrorType;
  readonly severity: ErrorSeverity;
  readonly code?: string;
  readonly context?: ErrorContext;
  readonly originalError?: Error;
  readonly isRetryable: boolean;
  readonly suggestedAction?: string;

  constructor(opts: StandardError) {
    super(opts.message);
    this.name = 'McpError';
    this.type = opts.type;
    this.severity = opts.severity;
    this.code = opts.code;
    this.context = opts.context;
    this.originalError = opts.originalError;
    this.isRetryable = opts.isRetryable;
    this.suggestedAction = opts.suggestedAction;
  }
}

/** Exit codes that signal intent to process managers (systemd, etc.) */
export const EXIT_CODES = {
  SUCCESS: 0,
  /** Don't restart — requires manual config fix */
  FATAL_CONFIG_ERROR: 1,
  /** OK to restart (transient failure) */
  TRANSIENT_ERROR: 2,
  /** Don't restart — needs manual cleanup */
  RESOURCE_EXHAUSTED: 3,
  /** Normal shutdown via SIGTERM */
  SIGNAL_GRACEFUL_SHUTDOWN: 15,
} as const;

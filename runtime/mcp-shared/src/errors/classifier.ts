/**
 * Error classifier chain.
 *
 * Each service registers a classifier function that inspects an error and
 * returns a StandardError if it recognizes the pattern, or null to pass
 * to the next classifier. A fallback classifier handles anything uncaught.
 */

import { ErrorSeverity, ErrorType, McpError, type StandardError } from './types.js';

export type ClassifierFn = (
  error: unknown,
  service: string,
  operation: string,
) => StandardError | null;

/**
 * Built-in classifier for common Node.js / network errors.
 * Runs last in the chain as a fallback.
 */
function classifyCommon(error: unknown, service: string, operation: string): StandardError {
  const err = error instanceof Error ? error : new Error(String(error));
  const msg = err.message.toLowerCase();
  const code = (err as Error & { code?: string }).code ?? '';
  const statusCode =
    (err as Error & { statusCode?: number; status?: number }).statusCode ??
    (err as Error & { status?: number }).status;

  // Already classified
  if (error instanceof McpError) return error;

  // Network errors
  if (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    code === 'EHOSTUNREACH'
  ) {
    return {
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.TRANSIENT,
      message: `Connection failed to ${service}: ${err.message}`,
      code,
      context: { service, operation },
      originalError: err,
      isRetryable: true,
    };
  }

  // Timeouts
  if (
    code === 'ETIMEDOUT' ||
    code === 'ESOCKETTIMEDOUT' ||
    msg.includes('timeout') ||
    msg.includes('timed out')
  ) {
    return {
      type: ErrorType.TIMEOUT,
      severity: ErrorSeverity.TRANSIENT,
      message: `Timeout in ${service}.${operation}: ${err.message}`,
      code,
      context: { service, operation },
      originalError: err,
      isRetryable: true,
    };
  }

  // HTTP status-based classification
  if (statusCode) {
    if (statusCode === 401 || statusCode === 403) {
      return {
        type: ErrorType.AUTH,
        severity: ErrorSeverity.DEGRADED,
        message: `Auth failure in ${service}: ${err.message}`,
        code: String(statusCode),
        context: { service, operation },
        originalError: err,
        isRetryable: false,
        suggestedAction: 'Check API credentials and permissions',
      };
    }
    if (statusCode === 404) {
      return {
        type: ErrorType.NOT_FOUND,
        severity: ErrorSeverity.USER_ERROR,
        message: err.message,
        code: '404',
        context: { service, operation },
        originalError: err,
        isRetryable: false,
      };
    }
    if (statusCode === 429) {
      return {
        type: ErrorType.RATE_LIMIT,
        severity: ErrorSeverity.TRANSIENT,
        message: `Rate limited by ${service}: ${err.message}`,
        code: '429',
        context: { service, operation },
        originalError: err,
        isRetryable: true,
        suggestedAction: 'Reduce request frequency or wait before retrying',
      };
    }
    if (statusCode >= 500) {
      return {
        type: ErrorType.SERVICE_UNAVAILABLE,
        severity: ErrorSeverity.TRANSIENT,
        message: `${service} server error: ${err.message}`,
        code: String(statusCode),
        context: { service, operation },
        originalError: err,
        isRetryable: true,
      };
    }
  }

  // Rate limit patterns in message body
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('throttl')) {
    return {
      type: ErrorType.RATE_LIMIT,
      severity: ErrorSeverity.TRANSIENT,
      message: `Rate limited by ${service}: ${err.message}`,
      context: { service, operation },
      originalError: err,
      isRetryable: true,
      suggestedAction: 'Wait before retrying',
    };
  }

  // Auth patterns
  if (
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('token expired') ||
    msg.includes('invalid token') ||
    msg.includes('authentication failed')
  ) {
    return {
      type: ErrorType.AUTH,
      severity: ErrorSeverity.DEGRADED,
      message: `Auth error in ${service}: ${err.message}`,
      context: { service, operation },
      originalError: err,
      isRetryable: false,
      suggestedAction: 'Check credentials',
    };
  }

  // Validation patterns
  if (
    msg.includes('invalid') ||
    msg.includes('validation') ||
    msg.includes('required field') ||
    msg.includes('must be') ||
    msg.includes('expected')
  ) {
    return {
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.USER_ERROR,
      message: err.message,
      context: { service, operation },
      originalError: err,
      isRetryable: false,
    };
  }

  // Fallback: unknown
  return {
    type: ErrorType.UNKNOWN,
    severity: ErrorSeverity.TRANSIENT,
    message: err.message,
    context: { service, operation },
    originalError: err,
    isRetryable: true,
  };
}

/**
 * PostgreSQL error classifier — uses PG error codes.
 */
export const classifyPostgres: ClassifierFn = (error, service, operation) => {
  const err = error instanceof Error ? error : null;
  if (!err) return null;
  const pgCode = (err as Error & { code?: string }).code;
  if (!pgCode || !/^\d{5}$|^[0-9A-Z]{5}$/.test(pgCode)) return null;

  // Connection errors (class 08)
  if (pgCode.startsWith('08')) {
    return {
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.TRANSIENT,
      message: `Database connection error: ${err.message}`,
      code: pgCode,
      context: { service, operation },
      originalError: err,
      isRetryable: true,
    };
  }

  // Too many connections (53300)
  if (pgCode === '53300') {
    return {
      type: ErrorType.SERVICE_UNAVAILABLE,
      severity: ErrorSeverity.DEGRADED,
      message: 'Connection pool exhausted',
      code: pgCode,
      context: { service, operation },
      originalError: err,
      isRetryable: true,
      suggestedAction: 'Retry in 30s',
    };
  }

  // Syntax / schema errors (class 42)
  if (pgCode.startsWith('42')) {
    return {
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.USER_ERROR,
      message: err.message,
      code: pgCode,
      context: { service, operation },
      originalError: err,
      isRetryable: false,
    };
  }

  // Query timeout (57014)
  if (pgCode === '57014') {
    return {
      type: ErrorType.TIMEOUT,
      severity: ErrorSeverity.TRANSIENT,
      message: 'Query timed out',
      code: pgCode,
      context: { service, operation },
      originalError: err,
      isRetryable: true,
      suggestedAction: 'Use LIMIT or simplify query',
    };
  }

  // Insufficient resources (class 53)
  if (pgCode.startsWith('53')) {
    return {
      type: ErrorType.SERVICE_UNAVAILABLE,
      severity: ErrorSeverity.DEGRADED,
      message: `Database resource issue: ${err.message}`,
      code: pgCode,
      context: { service, operation },
      originalError: err,
      isRetryable: true,
    };
  }

  return null;
};

/**
 * SSH error classifier.
 */
export const classifySSH: ClassifierFn = (error, service, operation) => {
  const err = error instanceof Error ? error : null;
  if (!err) return null;
  const msg = err.message.toLowerCase();

  if (
    msg.includes('no such identity') ||
    msg.includes('key not found') ||
    msg.includes('no such file')
  ) {
    return {
      type: ErrorType.SSH,
      severity: ErrorSeverity.FATAL,
      message: `SSH key not found: ${err.message}`,
      context: { service, operation },
      originalError: err,
      isRetryable: false,
      suggestedAction: 'Check SSH key path and permissions (chmod 600)',
    };
  }

  if (msg.includes('host key verification failed') || msg.includes('hostkey')) {
    return {
      type: ErrorType.AUTH,
      severity: ErrorSeverity.FATAL,
      message: `Host key verification failed: ${err.message}`,
      context: { service, operation },
      originalError: err,
      isRetryable: false,
      suggestedAction: 'Run ssh-keyscan to update known_hosts',
    };
  }

  if (msg.includes('permission denied') || msg.includes('publickey')) {
    return {
      type: ErrorType.AUTH,
      severity: ErrorSeverity.FATAL,
      message: `SSH auth failed: ${err.message}`,
      context: { service, operation },
      originalError: err,
      isRetryable: false,
      suggestedAction: 'Check SSH key permissions and authorized_keys on server',
    };
  }

  if (msg.includes('connection refused') || msg.includes('econnrefused')) {
    return {
      type: ErrorType.SSH,
      severity: ErrorSeverity.DEGRADED,
      message: `SSH connection refused to ${service}: ${err.message}`,
      context: { service, operation },
      originalError: err,
      isRetryable: true,
    };
  }

  if (msg.includes('command not found')) {
    return {
      type: ErrorType.SSH,
      severity: ErrorSeverity.DEGRADED,
      message: err.message,
      context: { service, operation },
      originalError: err,
      isRetryable: false,
      suggestedAction: 'Install the required command on the remote server',
    };
  }

  return null;
};

/**
 * Meta (Facebook/Instagram) API error classifier.
 */
export const classifyMeta: ClassifierFn = (error, service, operation) => {
  if (service !== 'meta') return null;
  const err = error instanceof Error ? error : null;
  if (!err) return null;
  const msg = err.message.toLowerCase();
  const errCode = (err as Error & { code?: number }).code;

  if (errCode === 190 || msg.includes('token expired') || msg.includes('oauthexception')) {
    return {
      type: ErrorType.AUTH,
      severity: ErrorSeverity.DEGRADED,
      message: `Meta token expired: ${err.message}`,
      context: { service, operation },
      originalError: err,
      isRetryable: false,
      suggestedAction: 'Refresh Meta access token',
    };
  }

  if (
    errCode === 4 ||
    errCode === 17 ||
    msg.includes('rate limit') ||
    msg.includes('too many calls')
  ) {
    return {
      type: ErrorType.RATE_LIMIT,
      severity: ErrorSeverity.TRANSIENT,
      message: `Meta rate limited: ${err.message}`,
      context: { service, operation },
      originalError: err,
      isRetryable: true,
      suggestedAction: 'Wait 60s before retrying',
    };
  }

  if (errCode === 10 || errCode === 200 || msg.includes('permission')) {
    return {
      type: ErrorType.AUTH,
      severity: ErrorSeverity.DEGRADED,
      message: `Meta permission error: ${err.message}`,
      context: { service, operation },
      originalError: err,
      isRetryable: false,
      suggestedAction: 'Check page/app permissions',
    };
  }

  return null;
};

/**
 * Gmail/Google API error classifier.
 */
export const classifyGoogle: ClassifierFn = (error, service, operation) => {
  if (service !== 'gmail' && service !== 'gsc') return null;
  const err = error instanceof Error ? error : null;
  if (!err) return null;
  const msg = err.message.toLowerCase();
  const statusCode =
    (err as Error & { code?: number; status?: number }).code ??
    (err as Error & { status?: number }).status;

  if (
    statusCode === 401 ||
    msg.includes('invalid_grant') ||
    msg.includes('token has been expired')
  ) {
    return {
      type: ErrorType.AUTH,
      severity: ErrorSeverity.DEGRADED,
      message: `Google token expired for ${service}: ${err.message}`,
      context: { service, operation },
      originalError: err,
      isRetryable: false,
      suggestedAction: 'Refresh OAuth token or re-authenticate',
    };
  }

  if (statusCode === 429 || msg.includes('rate limit') || msg.includes('quota')) {
    return {
      type: ErrorType.RATE_LIMIT,
      severity: ErrorSeverity.TRANSIENT,
      message: `Google API quota exceeded for ${service}: ${err.message}`,
      context: { service, operation },
      originalError: err,
      isRetryable: true,
      suggestedAction: 'Reduce request frequency',
    };
  }

  return null;
};

/**
 * ErrorClassifier — chains service-specific classifiers with a common fallback.
 *
 * Usage:
 *   const classifier = new ErrorClassifier();
 *   classifier.register(classifyPostgres);
 *   classifier.register(classifySSH);
 *   const classified = classifier.classify(error, 'postgres', 'query');
 */
export class ErrorClassifier {
  private readonly classifiers: ClassifierFn[] = [];

  register(fn: ClassifierFn): this {
    this.classifiers.push(fn);
    return this;
  }

  classify(error: unknown, service: string, operation: string): StandardError {
    // Already classified
    if (error instanceof McpError) return error;

    // Try each registered classifier in order
    for (const fn of this.classifiers) {
      const result = fn(error, service, operation);
      if (result) return result;
    }

    // Fallback to common classifier (always returns a result)
    return classifyCommon(error, service, operation);
  }
}

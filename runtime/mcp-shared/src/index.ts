// Server factory
export {
  createApexServer,
  type ApexServerOptions,
} from './server.js';

// Error classification and types
export {
  ErrorSeverity,
  ErrorType,
  McpError,
  EXIT_CODES,
  type StandardError,
  type ErrorContext,
} from './errors/types.js';

// Circuit breaker
export {
  CircuitBreaker,
  BREAKER_PRESETS,
  type CircuitBreakerConfig,
  type CircuitState,
} from './errors/circuit-breaker.js';

// Error classifier chain
export {
  ErrorClassifier,
  classifyPostgres,
  classifySSH,
  classifyMeta,
  classifyGoogle,
  type ClassifierFn,
} from './errors/classifier.js';

// Unified error handler with retry + breaker
export {
  UnifiedErrorHandler,
  RETRY_PRESETS,
  type RetryConfig,
  type ErrorHandlerOptions,
} from './errors/handler.js';

// Tool result builders
export {
  formatError,
  toolResult,
  geminiTextResult,
  toolError,
  imageResult,
  multimodalResult,
  multiContentResult,
  type ToolTextResult,
  type ToolImageResult,
  type ToolResult,
} from './results/index.js';

// Health check registration
export {
  registerHealthTool,
  type HealthReport,
  type ServiceHealth,
  type HealthCheckOptions,
} from './health/index.js';

// Structured logging
export { log } from './logging/index.js';

// Child-process proxy
export {
  proxyChildMcp,
  expandHome,
  type ProxyTarget,
} from './proxy/index.js';

// Media utilities (yt-dlp)
export {
  YtdlpClient,
  type YtdlpConfig,
  type VideoInfo,
  type SearchResult,
  type DownloadResult,
} from './media/ytdlp.js';
export * from "./worker-transport.js";

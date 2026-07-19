// Server factory

// Circuit breaker
export {
  BREAKER_PRESETS,
  CircuitBreaker,
  type CircuitBreakerConfig,
  type CircuitState,
} from './errors/circuit-breaker.js';
// Error classifier chain
export {
  type ClassifierFn,
  classifyGoogle,
  classifyMeta,
  classifyPostgres,
  classifySSH,
  ErrorClassifier,
} from './errors/classifier.js';
// Unified error handler with retry + breaker
export {
  type ErrorHandlerOptions,
  RETRY_PRESETS,
  type RetryConfig,
  UnifiedErrorHandler,
} from './errors/handler.js';
// Error classification and types
export {
  type ErrorContext,
  ErrorSeverity,
  ErrorType,
  EXIT_CODES,
  McpError,
  type StandardError,
} from './errors/types.js';
// Health check registration
export {
  type HealthCheckOptions,
  type HealthReport,
  registerHealthTool,
  type ServiceHealth,
} from './health/index.js';
// Structured logging
export { log } from './logging/index.js';
// Media utilities (yt-dlp)
export {
  type DownloadResult,
  type SearchResult,
  type VideoInfo,
  YtdlpClient,
  type YtdlpConfig,
} from './media/ytdlp.js';

// Completion-proof params for state-changing tools (ownership standard, MCP-substrate half)
export {
  evaluateProof,
  PROOF_FIELDS,
  type Proof,
  type ProofVerdict,
  proofObject,
  proofRefusal,
  proofShape,
  withProof,
} from './proof/index.js';
// Child-process proxy
export {
  expandHome,
  type ProxyTarget,
  proxyChildMcp,
} from './proxy/index.js';
// Tool result builders
export {
  formatError,
  geminiTextResult,
  imageResult,
  multiContentResult,
  multimodalResult,
  type ToolImageResult,
  type ToolResult,
  type ToolTextResult,
  toolError,
  toolResult,
} from './results/index.js';
export {
  type ApexServerOptions,
  createApexServer,
} from './server.js';
export * from './worker-transport.js';

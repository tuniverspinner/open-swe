import { createLogger, LogLevel } from "./logger.js";

const logger = createLogger(LogLevel.INFO, "AnthropicRetry");

export interface AnthropicRetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_ANTHROPIC_RETRY_CONFIG: AnthropicRetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000, // Start with 1 second
  maxDelayMs: 30000, // Cap at 30 seconds
  backoffMultiplier: 2,
};

export interface AnthropicError {
  type: "error";
  error: {
    type: string;
    message: string;
    details?: any;
  };
}

export function isAnthropicOverloadedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  
  // Check for Anthropic SDK error structure
  if ("message" in error && typeof error.message === "string") {
    try {
      const parsed = JSON.parse(error.message);
      return parsed.type === "error" && parsed.error?.type === "overloaded_error";
    } catch {
      // If JSON parsing fails, check if it's a string message about overloading
      return error.message.toLowerCase().includes("overloaded");
    }
  }
  
  // Check for direct error object structure
  if ("type" in error && error.type === "error" && "error" in error) {
    const errorObj = error as AnthropicError;
    return errorObj.error.type === "overloaded_error";
  }
  
  return false;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withAnthropicRetry<T>(
  operation: () => Promise<T>,
  config: Partial<AnthropicRetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_ANTHROPIC_RETRY_CONFIG, ...config };
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Only retry on Anthropic overloaded errors
      if (!isAnthropicOverloadedError(error)) {
        throw error;
      }
      
      // Don't retry if we've reached max attempts
      if (attempt >= retryConfig.maxRetries) {
        logger.error("Max retries exceeded for Anthropic overloaded error", {
          attempts: attempt + 1,
          maxRetries: retryConfig.maxRetries,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const baseDelay = retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt);
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * baseDelay;
      const delayMs = Math.min(baseDelay + jitter, retryConfig.maxDelayMs);
      
      logger.warn("Anthropic overloaded error detected, retrying...", {
        attempt: attempt + 1,
        maxRetries: retryConfig.maxRetries,
        delayMs: Math.round(delayMs),
        error: error instanceof Error ? error.message : String(error),
      });
      
      await delay(delayMs);
    }
  }
  
  throw lastError;
} 
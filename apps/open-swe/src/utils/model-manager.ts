import { initChatModel } from "langchain/chat_models/universal";
import { GraphConfig } from "@open-swe/shared/open-swe/types";
import { createLogger, LogLevel } from "./logger.js";
import { Task } from "./load-model.js";

const logger = createLogger(LogLevel.INFO, "ModelManager");

export interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  openedAt?: number;
}

interface ModelLoadConfig {
  provider: Provider;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  thinkingModel?: boolean;
  thinkingBudgetTokens?: number;
}

export enum CircuitState {
  CLOSED = "CLOSED", // Normal operation
  OPEN = "OPEN", // Failing, use fallback
}

export const PROVIDER_FALLBACK_ORDER = [
  "anthropic",
  "google-genai",
  "openai",
] as const;
export type Provider = (typeof PROVIDER_FALLBACK_ORDER)[number];

export interface ModelManagerConfig {
  circuitBreakerFailureThreshold: number; // Failures before opening circuit
  circuitBreakerTimeoutMs: number; // Time to wait before trying again (ms)
  fallbackOrder: Provider[];
}

export const DEFAULT_MODEL_MANAGER_CONFIG: ModelManagerConfig = {
  circuitBreakerFailureThreshold: 3, // Open after 3 failures
  circuitBreakerTimeoutMs: 300000, // 5 minutes timeout
  fallbackOrder: [...PROVIDER_FALLBACK_ORDER],
};

const MAX_RETRIES = 3;
const THINKING_BUDGET_TOKENS = 5000;

export class ModelManager {
  private config: ModelManagerConfig;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  constructor(config: Partial<ModelManagerConfig> = {}) {
    this.config = { ...DEFAULT_MODEL_MANAGER_CONFIG, ...config };

    logger.info("ModelManager initialized", {
      config: this.config,
      fallbackOrder: this.config.fallbackOrder,
    });
  }

  /**
   * Main method to load a model with fallback support
   */
  async loadModelWithFallback(graphConfig: GraphConfig, task: Task) {
    const startTime = Date.now();

    const modelConfigs = this.getModelConfigsForTask(graphConfig, task);

    logger.info("Model fallback", {
      task,
      totalOptions: modelConfigs.length,
      fallbackOrder: modelConfigs.map(
        (config) => `${config.provider}:${config.modelName}`,
      ),
    });

    let lastError: Error | undefined;

    for (let i = 0; i < modelConfigs.length; i++) {
      const modelConfig = modelConfigs[i];
      const modelKey = `${modelConfig.provider}:${modelConfig.modelName}`;

      try {
        logger.info(
          `Attempting to load model (attempt ${i + 1}/${modelConfigs.length})`,
          {
            provider: modelConfig.provider,
            modelName: modelConfig.modelName,
            task,
          },
        );

        if (!this.isCircuitClosed(modelKey)) {
          logger.warn(`Circuit breaker open for model: ${modelKey}, skipping`);
          continue;
        }

        const model = await this.initializeModel(modelConfig);

        this.recordSuccess(modelKey);

        logger.info("Successfully loaded model", {
          provider: modelConfig.provider,
          modelName: modelConfig.modelName,
          task,
          responseTime: Date.now() - startTime,
          fallbackAttempt: i + 1,
        });

        return model;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        logger.warn(
          `Failed to load model (attempt ${i + 1}/${modelConfigs.length})`,
          {
            provider: modelConfig.provider,
            modelName: modelConfig.modelName,
            task,
            error: lastError.message,
            modelKey,
          },
        );

        this.recordFailure(modelKey);
      }
    }

    const totalTime = Date.now() - startTime;
    logger.error("All model fallbacks exhausted", {
      task,
      attemptedConfigs: modelConfigs.length,
      totalTime,
      lastError: lastError?.message,
    });

    throw new Error(
      `Failed to load any model for task ${task}. Last error: ${lastError?.message || "Unknown error"}`,
    );
  }

  /**
   * Initialize the model instance
   */
  private async initializeModel(config: ModelLoadConfig) {
    const {
      provider,
      modelName,
      temperature,
      maxTokens,
      thinkingModel,
      thinkingBudgetTokens,
    } = config;

    const thinkingMaxTokens = thinkingBudgetTokens
      ? thinkingBudgetTokens * 4
      : undefined;

    let finalMaxTokens = maxTokens ?? 10_000;
    if (modelName.includes("claude-3-5-haiku")) {
      finalMaxTokens = finalMaxTokens > 8_192 ? 8_192 : finalMaxTokens;
    }

    const modelOptions: any = {
      modelProvider: provider,
      temperature: thinkingModel ? undefined : temperature,
      max_retries: MAX_RETRIES,
      ...(thinkingModel && provider === "anthropic"
        ? {
            thinking: { budget_tokens: thinkingBudgetTokens, type: "enabled" },
            maxTokens: thinkingMaxTokens,
          }
        : { maxTokens: finalMaxTokens }),
    };

    logger.debug("Initializing model", {
      provider,
      modelName,
      options: modelOptions,
    });

    return await initChatModel(modelName, modelOptions);
  }

  /**
   * Get ordered list of model configurations to try for a task
   */
  private getModelConfigsForTask(
    config: GraphConfig,
    task: Task,
  ): ModelLoadConfig[] {
    const baseConfig = this.getBaseConfigForTask(config, task);
    const configs: ModelLoadConfig[] = [];

    // try the user's preferred model (if configured)
    const preferredConfig = this.parseModelString(baseConfig.modelStr);
    if (preferredConfig) {
      configs.push({
        ...preferredConfig,
        temperature: baseConfig.temperature,
        maxTokens: baseConfig.maxTokens,
        thinkingModel: baseConfig.thinkingModel,
        thinkingBudgetTokens: baseConfig.thinkingBudgetTokens,
      });
    }

    for (const provider of this.config.fallbackOrder) {
      if (preferredConfig && provider === preferredConfig.provider) {
        continue;
      }

      const fallbackModel = this.getDefaultModelForProvider(provider, task);
      if (fallbackModel) {
        configs.push({
          ...fallbackModel,
          temperature: baseConfig.temperature,
          maxTokens: baseConfig.maxTokens,
          thinkingModel:
            baseConfig.thinkingModel && this.supportsThinking(provider),
          thinkingBudgetTokens: baseConfig.thinkingBudgetTokens,
        });
      }
    }

    return configs;
  }

  /**
   * Get base configuration for a task from GraphConfig
   */
  private getBaseConfigForTask(
    config: GraphConfig,
    task: Task,
  ): {
    modelStr: string;
    temperature: number;
    maxTokens: number;
    thinkingModel: boolean;
    thinkingBudgetTokens: number;
  } {
    const taskMap = {
      [Task.PROGRAMMER]: {
        modelName:
          config.configurable?.programmerModelName ??
          "anthropic:claude-sonnet-4-0",
        temperature: config.configurable?.programmerTemperature ?? 0,
      },
      [Task.ROUTER]: {
        modelName:
          config.configurable?.routerModelName ??
          "anthropic:claude-3-5-haiku-latest",
        temperature: config.configurable?.routerTemperature ?? 0,
      },
      [Task.SUMMARIZER]: {
        modelName:
          config.configurable?.summarizerModelName ??
          "anthropic:claude-sonnet-4-0",
        temperature: config.configurable?.summarizerTemperature ?? 0,
      },
    };

    const taskConfig = taskMap[task];
    const modelStr = taskConfig.modelName;
    const [modelProvider, ...modelNameParts] = modelStr.split(":");

    let thinkingModel = false;
    const thinkingBudgetTokens = THINKING_BUDGET_TOKENS;

    if (modelNameParts[0] === "extended-thinking") {
      thinkingModel = true;
      modelNameParts.shift();
    }

    const modelName = modelNameParts.join(":");
    if (modelProvider === "openai" && modelName.startsWith("o")) {
      thinkingModel = true;
    }

    return {
      modelStr,
      temperature: taskConfig.temperature,
      maxTokens: config.configurable?.maxTokens ?? 10_000,
      thinkingModel,
      thinkingBudgetTokens,
    };
  }

  /**
   * Parse model string into provider and model name
   */
  private parseModelString(modelStr: string): ModelLoadConfig | null {
    const [provider, ...modelNameParts] = modelStr.split(":");

    if (!this.isValidProvider(provider)) {
      logger.warn(`Invalid provider in model string: ${provider}`);
      return null;
    }

    let thinkingModel = false;
    const thinkingBudgetTokens = THINKING_BUDGET_TOKENS;

    if (modelNameParts[0] === "extended-thinking") {
      thinkingModel = true;
      modelNameParts.shift();
    }

    const modelName = modelNameParts.join(":");
    if (provider === "openai" && modelName.startsWith("o")) {
      thinkingModel = true;
    }

    return {
      provider: provider as Provider,
      modelName,
      thinkingModel,
      thinkingBudgetTokens,
    };
  }

  /**
   * Get default model for a provider and task
   */
  private getDefaultModelForProvider(
    provider: Provider,
    task: Task,
  ): ModelLoadConfig | null {
    const defaultModels: Record<Provider, Record<Task, string>> = {
      anthropic: {
        [Task.PROGRAMMER]: "claude-sonnet-4-0",
        [Task.ROUTER]: "claude-3-5-haiku-latest",
        [Task.SUMMARIZER]: "claude-sonnet-4-0",
      },
      "google-genai": {
        [Task.PROGRAMMER]: "gemini-2.5-pro-preview-05-06",
        [Task.ROUTER]: "gemini-2.5-flash-preview-05-20",
        [Task.SUMMARIZER]: "gemini-2.5-pro-preview-05-06",
      },
      openai: {
        [Task.PROGRAMMER]: "gpt-4o",
        [Task.ROUTER]: "gpt-4o-mini",
        [Task.SUMMARIZER]: "gpt-4o",
      },
    };

    const modelName = defaultModels[provider]?.[task];
    if (!modelName) {
      return null;
    }

    return {
      provider,
      modelName,
      thinkingModel: provider === "openai" && modelName.startsWith("o"),
      thinkingBudgetTokens: THINKING_BUDGET_TOKENS,
    };
  }

  /**
   * Circuit breaker methods
   */
  private isCircuitClosed(modelKey: string): boolean {
    const state = this.getCircuitState(modelKey);

    if (state.state === CircuitState.CLOSED) {
      return true;
    }

    if (state.state === CircuitState.OPEN && state.openedAt) {
      const timeElapsed = Date.now() - state.openedAt;
      if (timeElapsed >= this.config.circuitBreakerTimeoutMs) {
        state.state = CircuitState.CLOSED;
        state.failureCount = 0;
        delete state.openedAt;

        logger.info(`Circuit breaker automatically recovered: OPEN → CLOSED`, {
          modelKey,
          timeElapsed: (timeElapsed / 1000).toFixed(1) + "s",
        });
        return true;
      }
    }

    return false;
  }

  private getCircuitState(modelKey: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(modelKey)) {
      this.circuitBreakers.set(modelKey, {
        state: CircuitState.CLOSED,
        failureCount: 0,
        lastFailureTime: 0,
      });
    }
    return this.circuitBreakers.get(modelKey)!;
  }

  private recordSuccess(modelKey: string): void {
    const circuitState = this.getCircuitState(modelKey);

    circuitState.state = CircuitState.CLOSED;
    circuitState.failureCount = 0;
    delete circuitState.openedAt;

    logger.debug(`Circuit breaker reset after successful request`, {
      modelKey,
    });
  }

  private recordFailure(modelKey: string): void {
    const circuitState = this.getCircuitState(modelKey);
    const now = Date.now();

    circuitState.lastFailureTime = now;
    circuitState.failureCount++;

    if (
      circuitState.failureCount >= this.config.circuitBreakerFailureThreshold
    ) {
      circuitState.state = CircuitState.OPEN;
      circuitState.openedAt = now;

      logger.warn(
        `Circuit breaker opened for ${modelKey} after ${circuitState.failureCount} failures`,
        {
          modelKey,
          timeoutMs: this.config.circuitBreakerTimeoutMs,
          willRetryAt: new Date(
            now + this.config.circuitBreakerTimeoutMs,
          ).toISOString(),
        },
      );
    }
  }

  private isValidProvider(provider: string): provider is Provider {
    return PROVIDER_FALLBACK_ORDER.includes(provider as Provider);
  }

  private supportsThinking(provider: Provider): boolean {
    return provider === "anthropic" || provider === "openai";
  }

  /**
   * Monitoring and observability methods
   */
  public getCircuitBreakerStatus(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Cleanup on shutdown
   */
  public shutdown(): void {
    this.circuitBreakers.clear();
    logger.info("ModelManager shutdown complete");
  }
}

let globalModelManager: ModelManager | null = null;

export function getModelManager(
  config?: Partial<ModelManagerConfig>,
): ModelManager {
  if (!globalModelManager) {
    globalModelManager = new ModelManager(config);
  }
  return globalModelManager;
}

export function resetModelManager(): void {
  if (globalModelManager) {
    globalModelManager.shutdown();
    globalModelManager = null;
  }
}
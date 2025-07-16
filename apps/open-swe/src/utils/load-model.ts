import { GraphConfig } from "@open-swe/shared/open-swe/types";
import { getModelManager, ModelManagerConfig } from "./model-manager.js";
import { createLogger, LogLevel } from "./logger.js";

const logger = createLogger(LogLevel.INFO, "LoadModel");

export enum Task {
  /**
   * Used for programmer tasks. This includes: writing code,
   * generating plans, taking context gathering actions, etc.
   */
  PROGRAMMER = "programmer",
  /**
   * Used for routing tasks. This includes: initial request
   * routing to different agents.
   */
  ROUTER = "router",
  /**
   * Used for summarizing tasks. This includes: summarizing
   * the conversation history, summarizing actions taken during
   * a task execution, etc. Should be a slightly advanced model.
   */
  SUMMARIZER = "summarizer",
}

export async function loadModel(config: GraphConfig, task: Task) {
  const startTime = Date.now();

  const modelManagerConfig: Partial<ModelManagerConfig> = {
    circuitBreakerFailureThreshold: process.env.MODEL_CIRCUIT_BREAKER_THRESHOLD
      ? parseInt(process.env.MODEL_CIRCUIT_BREAKER_THRESHOLD)
      : undefined,
  };

  const modelManager = getModelManager(modelManagerConfig);

  try {
    const model = await modelManager.loadModelWithFallback(config, task);
    return model;
  } catch (error) {
    const loadTime = Date.now() - startTime;
    logger.error("Failed to load model with all fallbacks", {
      task,
      loadTime,
      error:
        error instanceof Error
          ? {
              message: error.message,
              name: error.name,
              stack: error.stack,
            }
          : String(error),
    });

    throw error;
  }
}
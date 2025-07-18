import { GraphConfig } from "@open-swe/shared/open-swe/types";
import { getModelManager, ModelManagerConfig } from "./model-manager.js";
import { FallbackRunnable } from "./runtime-fallback.js";
import { createLogger, LogLevel } from "./logger.js";

const logger = createLogger(LogLevel.INFO, "LoadModel");

export enum Task {
  PROGRAMMER = "programmer",
  ROUTER = "router",
  SUMMARIZER = "summarizer",
}

export async function loadModel(config: GraphConfig, task: Task) {
  const modelManager = getModelManager();

  try {
    const model = await modelManager.loadModel(config, task);
    if (!model) {
      throw new Error(`Model loading returned undefined for task: ${task}`);
    }
    const fallbackModel = new FallbackRunnable(
      model,
      config,
      task,
      modelManager,
    );
    return fallbackModel;
  } catch (error) {
    logger.error("Model loading failed", {
      task,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
